import "server-only";
import type { z } from "zod";
import type {
  createCategorySchema,
  createMenuItemSchema,
  createModifierGroupSchema,
  createModifierOptionSchema,
  createStationSchema,
  updateCategorySchema,
  updateMenuItemSchema,
  updateModifierGroupSchema,
  updateModifierOptionSchema,
  updateStationSchema,
} from "@/lib/schemas/menu";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/db-errors";
import { ApiError } from "@/server/errors";
import type { AuthedStaff } from "./auth";
import { writeAudit } from "./audit";

// ---------- shapes sent to the screens ----------

export type StationRow = { id: string; name: string; sortOrder: number; isActive: boolean };
export type CategoryRow = { id: string; nameKm: string; nameEn: string | null; sortOrder: number; isActive: boolean };
export type OptionRow = {
  id: string;
  groupId: string;
  nameKm: string;
  nameEn: string | null;
  priceDeltaCents: number;
  sortOrder: number;
  isActive: boolean;
};
export type GroupRow = {
  id: string;
  nameKm: string;
  nameEn: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  options: OptionRow[];
};
export type ItemRow = {
  id: string;
  categoryId: string;
  stationId: string;
  nameKm: string;
  nameEn: string | null;
  priceCents: number;
  isSoldOut: boolean;
  isActive: boolean;
  sortOrder: number;
  modifierGroupIds: string[];
};
export type MenuAdminData = { stations: StationRow[]; categories: CategoryRow[]; items: ItemRow[]; groups: GroupRow[] };

/** What the ordering screens need: only active things, nested, ready to show. */
export type OrderableMenu = {
  categories: {
    id: string;
    nameKm: string;
    nameEn: string | null;
    items: {
      id: string;
      nameKm: string;
      nameEn: string | null;
      priceCents: number;
      isSoldOut: boolean;
      stationId: string;
      modifierGroups: {
        id: string;
        nameKm: string;
        nameEn: string | null;
        minSelect: number;
        maxSelect: number;
        options: { id: string; nameKm: string; nameEn: string | null; priceDeltaCents: number }[];
      }[];
    }[];
  }[];
};

const STATION = { id: true, name: true, sortOrder: true, isActive: true } as const;
const CATEGORY = { id: true, nameKm: true, nameEn: true, sortOrder: true, isActive: true } as const;
const OPTION = { id: true, groupId: true, nameKm: true, nameEn: true, priceDeltaCents: true, sortOrder: true, isActive: true } as const;
const BY_ORDER = [{ sortOrder: "asc" }, { id: "asc" }] as const;

// ---------- reading ----------

export async function getMenuAdminData(): Promise<MenuAdminData> {
  const [stations, categories, items, groups] = await Promise.all([
    db.station.findMany({ select: STATION, orderBy: [...BY_ORDER] }),
    db.category.findMany({ select: CATEGORY, orderBy: [...BY_ORDER] }),
    db.menuItem.findMany({
      select: {
        id: true,
        categoryId: true,
        stationId: true,
        nameKm: true,
        nameEn: true,
        priceCents: true,
        isSoldOut: true,
        isActive: true,
        sortOrder: true,
        modifierGroups: { select: { modifierGroupId: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: [...BY_ORDER],
    }),
    db.modifierGroup.findMany({
      select: {
        id: true,
        nameKm: true,
        nameEn: true,
        minSelect: true,
        maxSelect: true,
        sortOrder: true,
        isActive: true,
        options: { select: OPTION, orderBy: [...BY_ORDER] },
      },
      orderBy: [...BY_ORDER],
    }),
  ]);

  return {
    stations,
    categories,
    items: items.map(({ modifierGroups, ...item }) => ({
      ...item,
      modifierGroupIds: modifierGroups.map((link) => link.modifierGroupId),
    })),
    groups,
  };
}

export async function getOrderableMenu(): Promise<OrderableMenu> {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: [...BY_ORDER],
    select: {
      id: true,
      nameKm: true,
      nameEn: true,
      items: {
        where: { isActive: true },
        orderBy: [...BY_ORDER],
        select: {
          id: true,
          nameKm: true,
          nameEn: true,
          priceCents: true,
          isSoldOut: true,
          stationId: true,
          modifierGroups: {
            where: { modifierGroup: { isActive: true } },
            orderBy: { sortOrder: "asc" },
            select: {
              modifierGroup: {
                select: {
                  id: true,
                  nameKm: true,
                  nameEn: true,
                  minSelect: true,
                  maxSelect: true,
                  options: {
                    where: { isActive: true },
                    orderBy: [...BY_ORDER],
                    select: { id: true, nameKm: true, nameEn: true, priceDeltaCents: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    categories: categories.map((category) => ({
      ...category,
      items: category.items.map(({ modifierGroups, ...item }) => ({
        ...item,
        modifierGroups: modifierGroups.map((link) => link.modifierGroup),
      })),
    })),
  };
}

// ---------- helpers ----------

type MaxSort = Promise<{ _max: { sortOrder: number | null } }>;

/** New things go to the end of their list. */
async function nextSortOrder(aggregate: MaxSort): Promise<number> {
  return ((await aggregate)._max.sortOrder ?? 0) + 10;
}

async function guardUnique<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
    throw error;
  }
}

const notFound = () => new ApiError(404, "NOT_FOUND");
const invalid = () => new ApiError(400, "INVALID_INPUT");


// ---------- stations ----------

export async function createStation(actor: AuthedStaff, input: z.infer<typeof createStationSchema>): Promise<StationRow> {
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder = input.sortOrder ?? (await nextSortOrder(tx.station.aggregate({ _max: { sortOrder: true } })));
      const row = await tx.station.create({ data: { name: input.name, sortOrder }, select: STATION });
      await writeAudit(tx, { actorId: actor.id, action: "menu.station_created", entityType: "Station", entityId: row.id, details: { name: row.name } });
      return row;
    }),
  );
}

export async function updateStation(actor: AuthedStaff, id: string, patch: z.infer<typeof updateStationSchema>): Promise<StationRow> {
  if (!(await db.station.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const row = await tx.station.update({ where: { id }, data: patch, select: STATION });
      await writeAudit(tx, { actorId: actor.id, action: "menu.station_updated", entityType: "Station", entityId: id, details: { fields: Object.keys(patch) } });
      return row;
    }),
  );
}

// ---------- categories ----------

export async function createCategory(actor: AuthedStaff, input: z.infer<typeof createCategorySchema>): Promise<CategoryRow> {
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder = input.sortOrder ?? (await nextSortOrder(tx.category.aggregate({ _max: { sortOrder: true } })));
      const row = await tx.category.create({
        data: { nameKm: input.nameKm, nameEn: input.nameEn ?? null, sortOrder },
        select: CATEGORY,
      });
      await writeAudit(tx, { actorId: actor.id, action: "menu.category_created", entityType: "Category", entityId: row.id, details: { name: row.nameKm } });
      return row;
    }),
  );
}

export async function updateCategory(actor: AuthedStaff, id: string, patch: z.infer<typeof updateCategorySchema>): Promise<CategoryRow> {
  if (!(await db.category.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const row = await tx.category.update({ where: { id }, data: patch, select: CATEGORY });
      await writeAudit(tx, { actorId: actor.id, action: "menu.category_updated", entityType: "Category", entityId: id, details: { fields: Object.keys(patch) } });
      return row;
    }),
  );
}

// ---------- menu items ----------

async function readItem(client: Pick<typeof db, "menuItem">, id: string): Promise<ItemRow> {
  const row = await client.menuItem.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      stationId: true,
      nameKm: true,
      nameEn: true,
      priceCents: true,
      isSoldOut: true,
      isActive: true,
      sortOrder: true,
      modifierGroups: { select: { modifierGroupId: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  const { modifierGroups, ...item } = row;
  return { ...item, modifierGroupIds: modifierGroups.map((link) => link.modifierGroupId) };
}

async function assertCategoryExists(id: string): Promise<void> {
  if (!(await db.category.findUnique({ where: { id }, select: { id: true } }))) throw invalid();
}

async function assertStationUsable(id: string): Promise<void> {
  const station = await db.station.findUnique({ where: { id }, select: { isActive: true } });
  if (!station || !station.isActive) throw invalid();
}

async function assertGroupsExist(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if ((await db.modifierGroup.count({ where: { id: { in: unique } } })) !== unique.length) throw invalid();
  return unique;
}

export async function createMenuItem(actor: AuthedStaff, input: z.infer<typeof createMenuItemSchema>): Promise<ItemRow> {
  await assertCategoryExists(input.categoryId);
  await assertStationUsable(input.stationId);
  const groupIds = await assertGroupsExist(input.modifierGroupIds ?? []);

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder =
        input.sortOrder ??
        (await nextSortOrder(tx.menuItem.aggregate({ where: { categoryId: input.categoryId }, _max: { sortOrder: true } })));
      const created = await tx.menuItem.create({
        data: {
          categoryId: input.categoryId,
          stationId: input.stationId,
          nameKm: input.nameKm,
          nameEn: input.nameEn ?? null,
          priceCents: input.priceCents,
          sortOrder,
          modifierGroups: { create: groupIds.map((modifierGroupId, index) => ({ modifierGroupId, sortOrder: index })) },
        },
        select: { id: true },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "menu.item_created",
        entityType: "MenuItem",
        entityId: created.id,
        details: { name: input.nameKm, priceCents: input.priceCents },
      });
      return readItem(tx, created.id);
    }),
  );
}

export async function updateMenuItem(actor: AuthedStaff, id: string, patch: z.infer<typeof updateMenuItemSchema>): Promise<ItemRow> {
  const existing = await db.menuItem.findUnique({ where: { id }, select: { priceCents: true, categoryId: true, stationId: true } });
  if (!existing) throw notFound();

  if (patch.categoryId && patch.categoryId !== existing.categoryId) await assertCategoryExists(patch.categoryId);
  if (patch.stationId && patch.stationId !== existing.stationId) await assertStationUsable(patch.stationId);
  const groupIds = patch.modifierGroupIds ? await assertGroupsExist(patch.modifierGroupIds) : undefined;

  const { modifierGroupIds: _ignored, ...fields } = patch;
  void _ignored;

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) await tx.menuItem.update({ where: { id }, data: fields });

      if (groupIds) {
        await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } });
        await tx.menuItemModifierGroup.createMany({
          data: groupIds.map((modifierGroupId, index) => ({ menuItemId: id, modifierGroupId, sortOrder: index })),
        });
      }

      await writeAudit(tx, {
        actorId: actor.id,
        action: "menu.item_updated",
        entityType: "MenuItem",
        entityId: id,
        details: { fields: Object.keys(patch) },
      });
      if (patch.priceCents !== undefined && patch.priceCents !== existing.priceCents) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: "menu.item_price_changed",
          entityType: "MenuItem",
          entityId: id,
          details: { from: existing.priceCents, to: patch.priceCents },
        });
      }
      return readItem(tx, id);
    }),
  );
}

/** "86" an item: the kitchen ran out. Quick and logged; changes nothing else. */
export async function setItemSoldOut(actor: AuthedStaff, id: string, isSoldOut: boolean): Promise<ItemRow> {
  const existing = await db.menuItem.findUnique({ where: { id }, select: { isSoldOut: true, nameKm: true } });
  if (!existing) throw notFound();
  if (existing.isSoldOut === isSoldOut) return readItem(db, id);

  return db.$transaction(async (tx) => {
    await tx.menuItem.update({ where: { id }, data: { isSoldOut } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "menu.sold_out_changed",
      entityType: "MenuItem",
      entityId: id,
      details: { isSoldOut, name: existing.nameKm },
    });
    return readItem(tx, id);
  });
}

// ---------- modifier groups and options ----------

async function readGroup(client: Pick<typeof db, "modifierGroup">, id: string): Promise<GroupRow> {
  return client.modifierGroup.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      nameKm: true,
      nameEn: true,
      minSelect: true,
      maxSelect: true,
      sortOrder: true,
      isActive: true,
      options: { select: OPTION, orderBy: [...BY_ORDER] },
    },
  });
}

export async function createModifierGroup(actor: AuthedStaff, input: z.infer<typeof createModifierGroupSchema>): Promise<GroupRow> {
  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder = input.sortOrder ?? (await nextSortOrder(tx.modifierGroup.aggregate({ _max: { sortOrder: true } })));
      const created = await tx.modifierGroup.create({
        data: {
          nameKm: input.nameKm,
          nameEn: input.nameEn ?? null,
          minSelect: input.minSelect,
          maxSelect: input.maxSelect,
          sortOrder,
        },
        select: { id: true },
      });
      await writeAudit(tx, { actorId: actor.id, action: "menu.group_created", entityType: "ModifierGroup", entityId: created.id, details: { name: input.nameKm } });
      return readGroup(tx, created.id);
    }),
  );
}

export async function updateModifierGroup(actor: AuthedStaff, id: string, patch: z.infer<typeof updateModifierGroupSchema>): Promise<GroupRow> {
  const existing = await db.modifierGroup.findUnique({ where: { id }, select: { minSelect: true, maxSelect: true } });
  if (!existing) throw notFound();

  // The patch may change only one of them, so check the combination that will result.
  const min = patch.minSelect ?? existing.minSelect;
  const max = patch.maxSelect ?? existing.maxSelect;
  if (min > max) throw invalid();

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      await tx.modifierGroup.update({ where: { id }, data: patch });
      await writeAudit(tx, { actorId: actor.id, action: "menu.group_updated", entityType: "ModifierGroup", entityId: id, details: { fields: Object.keys(patch) } });
      return readGroup(tx, id);
    }),
  );
}

export async function createModifierOption(
  actor: AuthedStaff,
  groupId: string,
  input: z.infer<typeof createModifierOptionSchema>,
): Promise<OptionRow> {
  if (!(await db.modifierGroup.findUnique({ where: { id: groupId }, select: { id: true } }))) throw notFound();

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const sortOrder = input.sortOrder ?? (await nextSortOrder(tx.modifierOption.aggregate({ where: { groupId }, _max: { sortOrder: true } })));
      const row = await tx.modifierOption.create({
        data: {
          groupId,
          nameKm: input.nameKm,
          nameEn: input.nameEn ?? null,
          priceDeltaCents: input.priceDeltaCents ?? 0,
          sortOrder,
        },
        select: OPTION,
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "menu.option_created",
        entityType: "ModifierOption",
        entityId: row.id,
        details: { name: row.nameKm, priceDeltaCents: row.priceDeltaCents },
      });
      return row;
    }),
  );
}

export async function updateModifierOption(actor: AuthedStaff, id: string, patch: z.infer<typeof updateModifierOptionSchema>): Promise<OptionRow> {
  const existing = await db.modifierOption.findUnique({ where: { id }, select: { priceDeltaCents: true } });
  if (!existing) throw notFound();

  return guardUnique(() =>
    db.$transaction(async (tx) => {
      const row = await tx.modifierOption.update({ where: { id }, data: patch, select: OPTION });
      await writeAudit(tx, { actorId: actor.id, action: "menu.option_updated", entityType: "ModifierOption", entityId: id, details: { fields: Object.keys(patch) } });
      if (patch.priceDeltaCents !== undefined && patch.priceDeltaCents !== existing.priceDeltaCents) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: "menu.option_price_changed",
          entityType: "ModifierOption",
          entityId: id,
          details: { from: existing.priceDeltaCents, to: patch.priceDeltaCents },
        });
      }
      return row;
    }),
  );
}

