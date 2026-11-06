import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { businessDateOf } from "@/lib/business-date";
import { calculateLineTotalCents } from "@/lib/money";
import { checkModifierSelection } from "@/lib/order-modifiers";
import type { addOrderItemSchema, createOrderSchema } from "@/lib/schemas/orders";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/db-errors";
import { env } from "@/server/env";
import { ApiError } from "@/server/errors";
import type { AuthedStaff } from "./auth";
import { writeAudit } from "./audit";
import { invalid, notFound } from "./shared";

// ---------- shapes sent to the screens ----------

export type OrderItemView = {
  id: string;
  menuItemId: string;
  nameKm: string;
  nameEn: string | null;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
  status: "NEW" | "PREPARING" | "READY" | "SERVED";
  modifiers: { id: string; groupNameKm: string; nameKm: string; priceDeltaCents: number }[];
  /** (price + options) x quantity, worked out by the money module */
  lineTotalCents: number;
  /** false = still a draft on the waiter's screen; true = sent to the kitchen on a ticket */
  sent: boolean;
  ticketNumber: number | null;
};

export type OrderView = {
  id: string;
  orderNumber: number;
  businessDate: string;
  type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: "OPEN" | "BILL_REQUESTED" | "PAID" | "VOIDED" | "MERGED";
  guestCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  mergedIntoId: string | null;
  mergedIntoNumber: number | null;
  openedBy: { id: string; name: string };
  createdAt: string;
  tables: { id: string; name: string }[];
  items: OrderItemView[];
  subtotalCents: number;
  /** items not yet sent to the kitchen */
  unsentCount: number;
  /** items the kitchen marked ready, waiting to be served */
  readyCount: number;
};

export type OrderSummary = {
  id: string;
  orderNumber: number;
  type: OrderView["type"];
  status: OrderView["status"];
  tableNames: string[];
  itemCount: number;
  subtotalCents: number;
  readyCount: number;
  createdAt: string;
};

const OPEN_STATUSES = ["OPEN", "BILL_REQUESTED"] as const;

const ORDER_VIEW = {
  id: true,
  orderNumber: true,
  businessDate: true,
  type: true,
  status: true,
  guestCount: true,
  customerName: true,
  customerPhone: true,
  deliveryAddress: true,
  mergedIntoId: true,
  mergedInto: { select: { orderNumber: true } },
  createdAt: true,
  openedBy: { select: { id: true, name: true } },
  tables: { where: { releasedAt: null }, orderBy: { createdAt: "asc" }, select: { table: { select: { id: true, name: true } } } },
  items: {
    where: { removedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      menuItemId: true,
      nameKm: true,
      nameEn: true,
      unitPriceCents: true,
      quantity: true,
      note: true,
      status: true,
      ticketId: true,
      ticket: { select: { ticketNumber: true } },
      modifiers: { orderBy: { id: "asc" }, select: { id: true, groupNameKm: true, nameKm: true, priceDeltaCents: true } },
    },
  },
} as const;

type ReadClient = Pick<typeof db, "order">;

export async function readOrder(client: ReadClient, id: string): Promise<OrderView> {
  const row = await client.order.findUniqueOrThrow({ where: { id }, select: ORDER_VIEW });

  const items: OrderItemView[] = row.items.map(({ ticketId, ticket, ...item }) => ({
    ...item,
    sent: ticketId !== null,
    ticketNumber: ticket?.ticketNumber ?? null,
    lineTotalCents: calculateLineTotalCents({
      unitPriceCents: item.unitPriceCents,
      modifierDeltasCents: item.modifiers.map((modifier) => modifier.priceDeltaCents),
      quantity: item.quantity,
    }),
  }));

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    businessDate: row.businessDate,
    type: row.type,
    status: row.status,
    guestCount: row.guestCount,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    deliveryAddress: row.deliveryAddress,
    mergedIntoId: row.mergedIntoId,
    mergedIntoNumber: row.mergedInto?.orderNumber ?? null,
    openedBy: row.openedBy,
    createdAt: row.createdAt.toISOString(),
    tables: row.tables.map((entry) => entry.table),
    items,
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    unsentCount: items.filter((item) => !item.sent).length,
    readyCount: items.filter((item) => item.status === "READY").length,
  };
}

// ---------- reading ----------

export async function getOrder(id: string): Promise<OrderView> {
  if (!(await db.order.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
  return readOrder(db, id);
}

/** Orders that are still open (including "bill requested"), oldest first. */
export async function listOpenOrders(): Promise<OrderSummary[]> {
  const rows = await db.order.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      type: true,
      status: true,
      createdAt: true,
      tables: { where: { releasedAt: null }, select: { table: { select: { name: true } } } },
      items: {
        where: { removedAt: null },
        select: { unitPriceCents: true, quantity: true, status: true, modifiers: { select: { priceDeltaCents: true } } },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    type: row.type,
    status: row.status,
    tableNames: row.tables.map((entry) => entry.table.name),
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: row.items.reduce(
      (sum, item) =>
        sum +
        calculateLineTotalCents({
          unitPriceCents: item.unitPriceCents,
          modifierDeltasCents: item.modifiers.map((modifier) => modifier.priceDeltaCents),
          quantity: item.quantity,
        }),
      0,
    ),
    readyCount: row.items.filter((item) => item.status === "READY").length,
    createdAt: row.createdAt.toISOString(),
  }));
}

// ---------- helpers ----------

/** Locks the orders until the end of the transaction, so two people cannot change the same order at once. */
export async function lockOrders(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" FOR UPDATE`;
}

/** Gap-free numbers (order numbers, ticket numbers): the counter is rolled back together with what used it. */
export async function nextCounter(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

type OrderState = { id: string; type: OrderView["type"]; status: OrderView["status"] };

export async function loadOpenOrder(tx: Prisma.TransactionClient, id: string): Promise<OrderState> {
  const order = await tx.order.findUnique({ where: { id }, select: { id: true, type: true, status: true } });
  if (!order) throw notFound();
  if (order.status !== "OPEN" && order.status !== "BILL_REQUESTED") throw new ApiError(409, "ORDER_CLOSED");
  return order;
}

const tableBusy = () => new ApiError(409, "TABLE_IN_USE");

// ---------- opening an order ----------

/**
 * Opens a dine-in, takeaway or delivery order.
 * Safe to send twice: the same clientOrderId always gives back the same order.
 */
export async function createOrder(
  actor: AuthedStaff,
  input: z.infer<typeof createOrderSchema>,
): Promise<{ order: OrderView; created: boolean }> {
  const existing = await db.order.findUnique({ where: { clientOrderId: input.clientOrderId }, select: { id: true } });
  if (existing) return { order: await readOrder(db, existing.id), created: false };

  try {
    const orderId = await db.$transaction(async (tx) => {
      const tableIds = [...new Set(input.tableIds ?? [])];

      if (input.type === "DINE_IN") {
        const tables = await tx.diningTable.findMany({
          where: { id: { in: tableIds } },
          select: { isActive: true, zone: { select: { isActive: true } } },
        });
        if (tables.length !== tableIds.length || tables.some((table) => !table.isActive || !table.zone.isActive)) throw invalid();
        if ((await tx.orderTable.count({ where: { tableId: { in: tableIds }, releasedAt: null } })) > 0) throw tableBusy();
      }

      const businessDate = businessDateOf(new Date(), env.RESTAURANT_TIMEZONE);
      const orderNumber = await nextCounter(tx, `order:${businessDate}`);

      const order = await tx.order.create({
        data: {
          clientOrderId: input.clientOrderId,
          businessDate,
          orderNumber,
          type: input.type,
          guestCount: input.guestCount ?? null,
          customerName: input.customerName ?? null,
          customerPhone: input.customerPhone ?? null,
          deliveryAddress: input.deliveryAddress ?? null,
          openedById: actor.id,
          tables: { create: tableIds.map((tableId) => ({ tableId })) },
        },
        select: { id: true },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "orders.order_created",
        entityType: "Order",
        entityId: order.id,
        details: { type: input.type, number: orderNumber, tables: tableIds.length },
      });
      return order.id;
    });
    return { order: await readOrder(db, orderId), created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Either the same request arrived twice at once, or someone took the table a moment before us.
    const again = await db.order.findUnique({ where: { clientOrderId: input.clientOrderId }, select: { id: true } });
    if (again) return { order: await readOrder(db, again.id), created: false };
    throw tableBusy();
  }
}

// ---------- items ----------

/**
 * Adds an item to an open order. The name, the price and the chosen options are COPIED into the
 * order, so later menu changes never change it. Safe to send twice (same clientItemId).
 */
export async function addItem(actor: AuthedStaff, orderId: string, input: z.infer<typeof addOrderItemSchema>): Promise<OrderView> {
  const sameRequest = async (): Promise<OrderView | null> => {
    const duplicate = await db.orderItem.findUnique({ where: { clientItemId: input.clientItemId }, select: { orderId: true } });
    if (!duplicate) return null;
    if (duplicate.orderId !== orderId) throw new ApiError(409, "CONFLICT"); // same id used for something else
    return readOrder(db, orderId);
  };

  const already = await sameRequest();
  if (already) return already;

  try {
    return await db.$transaction(async (tx) => {
      await lockOrders(tx, [orderId]);
      const order = await loadOpenOrder(tx, orderId);

      const menuItem = await tx.menuItem.findUnique({
        where: { id: input.menuItemId },
        select: {
          nameKm: true,
          nameEn: true,
          priceCents: true,
          isSoldOut: true,
          isActive: true,
          stationId: true,
          category: { select: { isActive: true } },
          modifierGroups: {
            where: { modifierGroup: { isActive: true } },
            select: {
              modifierGroup: {
                select: {
                  id: true,
                  nameKm: true,
                  minSelect: true,
                  maxSelect: true,
                  options: { where: { isActive: true }, select: { id: true, nameKm: true, priceDeltaCents: true } },
                },
              },
            },
          },
        },
      });
      if (!menuItem || !menuItem.isActive || !menuItem.category.isActive) throw invalid();
      if (menuItem.isSoldOut) throw new ApiError(409, "ITEM_SOLD_OUT");

      const groups = menuItem.modifierGroups.map((link) => link.modifierGroup);
      const selection = checkModifierSelection(
        groups.map((group) => ({
          id: group.id,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          optionIds: group.options.map((option) => option.id),
        })),
        input.optionIds,
      );
      if (!selection.ok) throw invalid();

      const chosen = groups.flatMap((group) =>
        group.options
          .filter((option) => input.optionIds.includes(option.id))
          .map((option) => ({ groupNameKm: group.nameKm, ...option })),
      );

      const item = await tx.orderItem.create({
        data: {
          clientItemId: input.clientItemId,
          orderId,
          menuItemId: input.menuItemId,
          nameKm: menuItem.nameKm,
          nameEn: menuItem.nameEn,
          unitPriceCents: menuItem.priceCents,
          quantity: input.quantity,
          note: input.note ?? null,
          stationId: menuItem.stationId,
          addedById: actor.id,
          modifiers: {
            create: chosen.map((option) => ({
              modifierOptionId: option.id,
              groupNameKm: option.groupNameKm,
              nameKm: option.nameKm,
              priceDeltaCents: option.priceDeltaCents,
            })),
          },
        },
        select: { id: true },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "orders.item_added",
        entityType: "Order",
        entityId: orderId,
        details: { itemId: item.id, name: menuItem.nameKm, quantity: input.quantity },
      });

      // A guest who asks for the bill and then orders another drink: the order is open again.
      if (order.status === "BILL_REQUESTED") {
        await tx.order.update({ where: { id: orderId }, data: { status: "OPEN" } });
        await writeAudit(tx, { actorId: actor.id, action: "orders.bill_cancelled", entityType: "Order", entityId: orderId });
      }
      return readOrder(tx, orderId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const retried = await sameRequest(); // the same request arrived twice at once
      if (retried) return retried;
    }
    throw error;
  }
}

/** Takes an item off the order. Not deleted: it is marked as removed and stays in the history. */
export async function removeItem(actor: AuthedStaff, orderId: string, itemId: string): Promise<OrderView> {
  return db.$transaction(async (tx) => {
    await lockOrders(tx, [orderId]);
    await loadOpenOrder(tx, orderId);

    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: { orderId: true, removedAt: true, ticketId: true, nameKm: true, quantity: true },
    });
    if (!item || item.orderId !== orderId) throw notFound();
    if (item.removedAt) return readOrder(tx, orderId); // already removed: nothing to do

    // Once an item is on a kitchen ticket the kitchen may already be cooking it.
    // (Voiding a sent item with a manager's approval comes with the void and refund phase.)
    if (item.ticketId !== null) throw new ApiError(409, "ITEM_SENT");

    await tx.orderItem.update({ where: { id: itemId }, data: { removedAt: new Date(), removedById: actor.id } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "orders.item_removed",
      entityType: "Order",
      entityId: orderId,
      details: { itemId, name: item.nameKm, quantity: item.quantity },
    });
    return readOrder(tx, orderId);
  });
}

// ---------- bill, cancel ----------

/** "The guests asked for the bill" (true) or "not yet" (false). Shows on the floor plan. */
export async function setBillRequested(actor: AuthedStaff, orderId: string, requested: boolean): Promise<OrderView> {
  return db.$transaction(async (tx) => {
    await lockOrders(tx, [orderId]);
    const order = await loadOpenOrder(tx, orderId);
    const target = requested ? "BILL_REQUESTED" : "OPEN";
    if (order.status === target) return readOrder(tx, orderId);

    if (requested && (await tx.orderItem.count({ where: { orderId, removedAt: null } })) === 0) throw invalid();

    await tx.order.update({ where: { id: orderId }, data: { status: target } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: requested ? "orders.bill_requested" : "orders.bill_cancelled",
      entityType: "Order",
      entityId: orderId,
    });
    return readOrder(tx, orderId);
  });
}

/** For an order opened by mistake: only possible while it has no items. Frees its tables. */
export async function cancelEmptyOrder(actor: AuthedStaff, orderId: string): Promise<OrderView> {
  return db.$transaction(async (tx) => {
    await lockOrders(tx, [orderId]);
    await loadOpenOrder(tx, orderId);
    if ((await tx.orderItem.count({ where: { orderId, removedAt: null } })) > 0) throw new ApiError(409, "ORDER_NOT_EMPTY");

    await tx.order.update({ where: { id: orderId }, data: { status: "VOIDED" } });
    await tx.orderTable.updateMany({ where: { orderId, releasedAt: null }, data: { releasedAt: new Date() } });
    await writeAudit(tx, { actorId: actor.id, action: "orders.order_cancelled_empty", entityType: "Order", entityId: orderId });
    return readOrder(tx, orderId);
  });
}

// ---------- transfer and merge ----------

/** The guests move to another table. */
export async function transferTable(actor: AuthedStaff, orderId: string, fromTableId: string, toTableId: string): Promise<OrderView> {
  if (fromTableId === toTableId) throw invalid();

  try {
    return await db.$transaction(async (tx) => {
      await lockOrders(tx, [orderId]);
      const order = await loadOpenOrder(tx, orderId);
      if (order.type !== "DINE_IN") throw invalid();

      const current = await tx.orderTable.findFirst({ where: { orderId, tableId: fromTableId, releasedAt: null }, select: { id: true } });
      if (!current) throw invalid();

      const target = await tx.diningTable.findUnique({
        where: { id: toTableId },
        select: { isActive: true, zone: { select: { isActive: true } } },
      });
      if (!target || !target.isActive || !target.zone.isActive) throw invalid();
      if ((await tx.orderTable.count({ where: { tableId: toTableId, releasedAt: null } })) > 0) throw tableBusy();

      await tx.orderTable.update({ where: { id: current.id }, data: { releasedAt: new Date() } });
      await tx.orderTable.create({ data: { orderId, tableId: toTableId } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "orders.table_transferred",
        entityType: "Order",
        entityId: orderId,
        details: { from: fromTableId, to: toTableId },
      });
      return readOrder(tx, orderId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw tableBusy(); // someone took the table at the same moment
    throw error;
  }
}

/**
 * Two groups sit together: the items and tables of `sourceOrderId` move into `targetOrderId`,
 * and the source order is marked MERGED (it stays in the history).
 */
export async function mergeOrders(actor: AuthedStaff, targetOrderId: string, sourceOrderId: string): Promise<OrderView> {
  if (targetOrderId === sourceOrderId) throw invalid();

  return db.$transaction(async (tx) => {
    await lockOrders(tx, [targetOrderId, sourceOrderId]);
    const target = await loadOpenOrder(tx, targetOrderId);
    const source = await loadOpenOrder(tx, sourceOrderId);
    if (target.type !== "DINE_IN" || source.type !== "DINE_IN") throw invalid();

    const moved = await tx.orderItem.updateMany({ where: { orderId: sourceOrderId }, data: { orderId: targetOrderId } });
    // Kitchen tickets follow their items, so the kitchen sees the surviving order's number and tables.
    await tx.kitchenTicket.updateMany({ where: { orderId: sourceOrderId }, data: { orderId: targetOrderId } });
    await tx.orderTable.updateMany({ where: { orderId: sourceOrderId, releasedAt: null }, data: { orderId: targetOrderId } });

    const guests = await tx.order.findMany({ where: { id: { in: [targetOrderId, sourceOrderId] } }, select: { guestCount: true } });
    const guestCount = guests.some((g) => g.guestCount !== null) ? guests.reduce((sum, g) => sum + (g.guestCount ?? 0), 0) : null;

    await tx.order.update({ where: { id: sourceOrderId }, data: { status: "MERGED", mergedIntoId: targetOrderId } });
    // New items arrived, so the bill is no longer "requested".
    await tx.order.update({ where: { id: targetOrderId }, data: { status: "OPEN", guestCount } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "orders.merged",
      entityType: "Order",
      entityId: targetOrderId,
      details: { source: sourceOrderId, items: moved.count },
    });
    return readOrder(tx, targetOrderId);
  });
}
