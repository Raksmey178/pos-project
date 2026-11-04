import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { findFreeSpot, fitsInGrid, overlapsAny, type Rect } from "@/lib/floor-plan";
import type { createTableSchema, createZoneSchema, updateTableSchema, updateZoneSchema } from "@/lib/schemas/tables";
import type { TableStatus } from "@/lib/table-status";
import { db } from "@/server/db";
import { ApiError } from "@/server/errors";
import type { AuthedStaff } from "./auth";
import { writeAudit } from "./audit";
import { guardUnique, invalid, nextSortOrder, notFound } from "./shared";

// ---------- shapes sent to the screens ----------

export type ZoneRow = { id: string; name: string; sortOrder: number; isActive: boolean };
export type TableRow = {
  id: string;
  zoneId: string;
  name: string;
  capacity: number;
  shape: "RECT" | "ROUND";
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  isActive: boolean;
  status: TableStatus;
};
export type FloorPlan = { zones: { id: string; name: string; tables: TableRow[] }[] };
export type TablesAdminData = { zones: ZoneRow[]; tables: TableRow[] };

const ZONE = { id: true, name: true, sortOrder: true, isActive: true } as const;
const TABLE = {
  id: true,
  zoneId: true,
  name: true,
  capacity: true,
  shape: true,
  gridX: true,
  gridY: true,
  width: true,
  height: true,
  isActive: true,
} as const;
const BY_ORDER = [{ sortOrder: "asc" }, { id: "asc" }] as const;

type Placed = { gridX: number; gridY: number; width: number; height: number };
const toRect = (table: Placed): Rect => ({ x: table.gridX, y: table.gridY, w: table.width, h: table.height });

// A table's status is worked out, never stored. Orders arrive in Phase 5: from then on
// "occupied" / "bill requested" come from the table's open order. Until then every table is free.
function withStatus<T extends object>(row: T): T & { status: TableStatus } {
  return { ...row, status: "AVAILABLE" };
}

// ---------- reading ----------

/** What waiters see: only active zones and active tables. */
export async function getFloorPlan(): Promise<FloorPlan> {
  const zones = await db.zone.findMany({
    where: { isActive: true },
    orderBy: [...BY_ORDER],
    select: { id: true, name: true, tables: { where: { isActive: true }, orderBy: { name: "asc" }, select: TABLE } },
  });
  return { zones: zones.map((zone) => ({ id: zone.id, name: zone.name, tables: zone.tables.map(withStatus) })) };
}

/** What the manager edits: everything, including switched-off zones and tables. */
export async function getTablesAdminData(): Promise<TablesAdminData> {
  const [zones, tables] = await Promise.all([
    db.zone.findMany({ select: ZONE, orderBy: [...BY_ORDER] }),
    db.diningTable.findMany({ select: TABLE, orderBy: { name: "asc" } }),
  ]);
  return { zones, tables: tables.map(withStatus) };
}

// ---------- helpers ----------

/**
 * Locks the zone(s) until the end of the transaction. Two managers editing the same
 * zone at the same moment then queue up, so two tables can never be placed on the same spot.
 * (Zones are always locked in the same order, so they cannot block each other forever.)
 */
async function lockZones(tx: Prisma.TransactionClient, zoneIds: string[]): Promise<void> {
  const ids = [...new Set(zoneIds)].sort();
  await tx.$queryRaw`SELECT "id" FROM "Zone" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
}

// ---------- zones ----------

export async function createZone(actor: AuthedStaff, input: z.infer<typeof createZoneSchema>): Promise<ZoneRow> {
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder = input.sortOrder ?? (await nextSortOrder(tx.zone.aggregate({ _max: { sortOrder: true } })));
      const row = await tx.zone.create({ data: { name: input.name, sortOrder }, select: ZONE });
      await writeAudit(tx, { actorId: actor.id, action: "tables.zone_created", entityType: "Zone", entityId: row.id, details: { name: row.name } });
      return row;
    }),
  );
}

export async function updateZone(actor: AuthedStaff, id: string, patch: z.infer<typeof updateZoneSchema>): Promise<ZoneRow> {
  if (!(await db.zone.findUnique({ where: { id }, select: { id: true } }))) throw notFound();

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      await lockZones(tx, [id]);

      // A zone with tables in use cannot be switched off: its tables would disappear from the floor plan.
      if (patch.isActive === false && (await tx.diningTable.count({ where: { zoneId: id, isActive: true } })) > 0) {
        throw new ApiError(409, "ZONE_NOT_EMPTY");
      }

      const row = await tx.zone.update({ where: { id }, data: patch, select: ZONE });
      await writeAudit(tx, { actorId: actor.id, action: "tables.zone_updated", entityType: "Zone", entityId: id, details: { fields: Object.keys(patch) } });
      return row;
    }),
  );
}

// ---------- tables ----------

export async function createTable(actor: AuthedStaff, input: z.infer<typeof createTableSchema>): Promise<TableRow> {
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      await lockZones(tx, [input.zoneId]);

      const zone = await tx.zone.findUnique({ where: { id: input.zoneId }, select: { isActive: true } });
      if (!zone || !zone.isActive) throw invalid();

      const taken = (
        await tx.diningTable.findMany({ where: { zoneId: input.zoneId, isActive: true }, select: { gridX: true, gridY: true, width: true, height: true } })
      ).map(toRect);

      let spot: { x: number; y: number };
      if (input.gridX !== undefined && input.gridY !== undefined) {
        const rect = { x: input.gridX, y: input.gridY, w: input.width, h: input.height };
        if (!fitsInGrid(rect)) throw invalid();
        if (overlapsAny(rect, taken)) throw new ApiError(409, "TABLE_OVERLAP");
        spot = { x: rect.x, y: rect.y };
      } else {
        const free = findFreeSpot(taken, input.width, input.height);
        if (!free) throw new ApiError(409, "ZONE_FULL");
        spot = free;
      }

      const row = await tx.diningTable.create({
        data: {
          zoneId: input.zoneId,
          name: input.name,
          capacity: input.capacity,
          shape: input.shape,
          gridX: spot.x,
          gridY: spot.y,
          width: input.width,
          height: input.height,
        },
        select: TABLE,
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "tables.table_created",
        entityType: "DiningTable",
        entityId: row.id,
        details: { name: row.name, zoneId: row.zoneId },
      });
      return withStatus(row);
    }),
  );
}

export async function updateTable(actor: AuthedStaff, id: string, patch: z.infer<typeof updateTableSchema>): Promise<TableRow> {
  const before = await db.diningTable.findUnique({ where: { id }, select: { zoneId: true } });
  if (!before) throw notFound();

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      await lockZones(tx, patch.zoneId ? [before.zoneId, patch.zoneId] : [before.zoneId]);

      // Read again now that we hold the lock: someone else may just have changed it.
      const current = await tx.diningTable.findUnique({ where: { id }, select: TABLE });
      if (!current) throw notFound();
      if (current.zoneId !== before.zoneId) throw new ApiError(409, "CONFLICT"); // moved meanwhile; reload and retry

      const result = {
        zoneId: patch.zoneId ?? current.zoneId,
        gridX: patch.gridX ?? current.gridX,
        gridY: patch.gridY ?? current.gridY,
        width: patch.width ?? current.width,
        height: patch.height ?? current.height,
        isActive: patch.isActive ?? current.isActive,
      };

      const zone = await tx.zone.findUnique({ where: { id: result.zoneId }, select: { isActive: true } });
      if (!zone || (result.isActive && !zone.isActive) || (result.zoneId !== current.zoneId && !zone.isActive)) throw invalid();

      // Switched-off tables take no space, so only active tables are checked.
      if (result.isActive) {
        const rect = toRect(result);
        if (!fitsInGrid(rect)) throw invalid();
        const others = await tx.diningTable.findMany({
          where: { zoneId: result.zoneId, isActive: true, id: { not: id } },
          select: { gridX: true, gridY: true, width: true, height: true },
        });
        if (overlapsAny(rect, others.map(toRect))) throw new ApiError(409, "TABLE_OVERLAP");
      }

      // Phase 5: switching a table off must be refused while it has an open order.
      const row = await tx.diningTable.update({ where: { id }, data: patch, select: TABLE });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "tables.table_updated",
        entityType: "DiningTable",
        entityId: id,
        details: { fields: Object.keys(patch) },
      });
      return withStatus(row);
    }),
  );
}
