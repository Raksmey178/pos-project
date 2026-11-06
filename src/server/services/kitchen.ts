import "server-only";
import { businessDateOf } from "@/lib/business-date";
import { isSingleStep, isForward, permissionForStep, type ItemStatus } from "@/lib/item-status";
import { db } from "@/server/db";
import { hasPermission } from "@/server/auth/permissions";
import { isUniqueViolation } from "@/server/db-errors";
import { env } from "@/server/env";
import { ApiError } from "@/server/errors";
import type { AuthedStaff } from "./auth";
import { writeAudit } from "./audit";
import { loadOpenOrder, lockOrders, nextCounter, readOrder, type OrderView } from "./orders";
import { invalid, notFound } from "./shared";

// ---------- shapes sent to the screens ----------

export type KitchenItemView = {
  id: string;
  nameKm: string;
  quantity: number;
  note: string | null;
  status: ItemStatus;
  modifiers: { groupNameKm: string; nameKm: string }[];
};

export type KitchenTicketView = {
  id: string;
  ticketNumber: number;
  stationId: string;
  stationName: string;
  orderId: string;
  orderNumber: number;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableNames: string[];
  sentAt: string;
  printCount: number;
  items: KitchenItemView[];
};

export type KitchenBoard = {
  stations: { id: string; name: string }[];
  tickets: KitchenTicketView[];
};

export type SentTicket = { id: string; ticketNumber: number; stationId: string; stationName: string };

const OPEN_STATUSES = ["OPEN", "BILL_REQUESTED"] as const;

const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  stationId: true,
  station: { select: { name: true } },
  sentAt: true,
  printCount: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      type: true,
      tables: { where: { releasedAt: null }, orderBy: { createdAt: "asc" }, select: { table: { select: { name: true } } } },
    },
  },
  items: {
    where: { removedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nameKm: true,
      quantity: true,
      note: true,
      status: true,
      modifiers: { orderBy: { id: "asc" }, select: { groupNameKm: true, nameKm: true } },
    },
  },
} as const;

type TicketRow = {
  id: string;
  ticketNumber: number;
  stationId: string;
  station: { name: string };
  sentAt: Date;
  printCount: number;
  order: { id: string; orderNumber: number; type: KitchenTicketView["orderType"]; tables: { table: { name: string } }[] };
  items: KitchenItemView[];
};

function toTicketView(row: TicketRow): KitchenTicketView {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    stationId: row.stationId,
    stationName: row.station.name,
    orderId: row.order.id,
    orderNumber: row.order.orderNumber,
    orderType: row.order.type,
    tableNames: row.order.tables.map((entry) => entry.table.name),
    sentAt: row.sentAt.toISOString(),
    printCount: row.printCount,
    items: row.items,
  };
}

// ---------- sending ----------

/**
 * "Send to kitchen": the new items of the order become kitchen tickets, one per station.
 * Only items that were not sent before are included, so sending again later sends only the newer ones.
 * Safe to send twice: the same clientSendId gives back the tickets it made the first time.
 */
export async function sendToKitchen(
  actor: AuthedStaff,
  orderId: string,
  clientSendId: string,
): Promise<{ order: OrderView; tickets: SentTicket[]; created: boolean }> {
  const sameRequest = async () => {
    const tickets = await db.kitchenTicket.findMany({
      where: { clientSendId },
      orderBy: { ticketNumber: "asc" },
      select: { id: true, ticketNumber: true, stationId: true, orderId: true, station: { select: { name: true } } },
    });
    if (tickets.length === 0) return null;
    if (tickets.some((ticket) => ticket.orderId !== orderId)) throw new ApiError(409, "CONFLICT"); // id used for something else
    return {
      order: await readOrder(db, orderId),
      tickets: tickets.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber, stationId: t.stationId, stationName: t.station.name })),
      created: false,
    };
  };

  const already = await sameRequest();
  if (already) return already;

  try {
    const tickets = await db.$transaction(async (tx) => {
      await lockOrders(tx, [orderId]);

      // The same request may have been waiting for the lock while its twin did the work.
      // Then there is nothing left to send, and the right answer is the twin's tickets, not an error.
      if (await tx.kitchenTicket.findFirst({ where: { clientSendId }, select: { id: true } })) return null;

      await loadOpenOrder(tx, orderId);

      const unsent = await tx.orderItem.findMany({
        where: { orderId, removedAt: null, ticketId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, stationId: true },
      });
      if (unsent.length === 0) throw new ApiError(409, "NOTHING_TO_SEND");

      const byStation = new Map<string, string[]>();
      for (const item of unsent) byStation.set(item.stationId, [...(byStation.get(item.stationId) ?? []), item.id]);

      const now = new Date();
      const businessDate = businessDateOf(now, env.RESTAURANT_TIMEZONE);
      const made: SentTicket[] = [];

      for (const [stationId, itemIds] of byStation) {
        const ticketNumber = await nextCounter(tx, `ticket:${businessDate}`);
        const ticket = await tx.kitchenTicket.create({
          data: { clientSendId, orderId, stationId, ticketNumber, sentById: actor.id, sentAt: now },
          select: { id: true, ticketNumber: true, stationId: true, station: { select: { name: true } } },
        });
        await tx.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { ticketId: ticket.id, sentAt: now } });
        made.push({ id: ticket.id, ticketNumber: ticket.ticketNumber, stationId: ticket.stationId, stationName: ticket.station.name });
      }

      await writeAudit(tx, {
        actorId: actor.id,
        action: "kitchen.sent",
        entityType: "Order",
        entityId: orderId,
        details: { tickets: made.length, items: unsent.length },
      });
      return made;
    });
    if (tickets === null) {
      const twin = await sameRequest();
      if (twin) return twin;
      throw new ApiError(409, "CONFLICT");
    }
    return { order: await readOrder(db, orderId), tickets, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const retried = await sameRequest(); // the same request arrived twice at once
      if (retried) return retried;
    }
    throw error;
  }
}

// ---------- the board ----------

/** Tickets that still have something to do, oldest first, plus the stations to filter by. */
export async function getKitchenBoard(): Promise<KitchenBoard> {
  const [stations, tickets] = await Promise.all([
    db.station.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    db.kitchenTicket.findMany({
      where: {
        order: { status: { in: [...OPEN_STATUSES] } },
        items: { some: { removedAt: null, status: { not: "SERVED" } } },
      },
      orderBy: [{ sentAt: "asc" }, { ticketNumber: "asc" }],
      select: TICKET_SELECT,
    }),
  ]);
  return { stations, tickets: tickets.map(toTicketView) };
}

// ---------- item status ----------

/**
 * Moves items one step: start cooking, ready, served (or one step back to undo).
 * `from` is what the screen believes the items are now: if someone else already changed them
 * the request is refused (STATUS_CHANGED) instead of overwriting. Items already at `to` are left alone.
 */
export async function setItemsStatus(
  actor: AuthedStaff,
  input: { itemIds: string[]; from: ItemStatus; to: ItemStatus },
): Promise<{ changed: number }> {
  if (!isSingleStep(input.from, input.to)) throw invalid();
  if (!hasPermission(actor.role, permissionForStep(input.from, input.to))) throw new ApiError(403, "FORBIDDEN");

  const ids = [...new Set(input.itemIds)];

  return db.$transaction(async (tx) => {
    const found = await tx.orderItem.findMany({ where: { id: { in: ids } }, select: { orderId: true } });
    if (found.length !== ids.length) throw notFound();
    await lockOrders(tx, found.map((item) => item.orderId));

    const items = await tx.orderItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, orderId: true, status: true, ticketId: true, removedAt: true, order: { select: { status: true } } },
    });

    for (const item of items) {
      const orderOpen = item.order.status === "OPEN" || item.order.status === "BILL_REQUESTED";
      if (item.removedAt || item.ticketId === null || !orderOpen) throw invalid(); // never sent, removed, or the order is closed
      if (item.status !== input.from && item.status !== input.to) throw new ApiError(409, "STATUS_CHANGED");
    }

    const toChange = items.filter((item) => item.status === input.from);
    if (toChange.length === 0) return { changed: 0 }; // everything is already there

    const now = new Date();
    const forward = isForward(input.from, input.to);
    // Moving forward stamps the time; moving back clears the stamp of the step that is undone.
    const stampColumn = { PREPARING: "preparingAt", READY: "readyAt", SERVED: "servedAt" } as const;
    const stamp = forward
      ? input.to !== "NEW"
        ? { [stampColumn[input.to]]: now }
        : {}
      : input.from !== "NEW"
        ? { [stampColumn[input.from]]: null }
        : {};

    await tx.orderItem.updateMany({
      where: { id: { in: toChange.map((item) => item.id) }, status: input.from },
      data: { status: input.to, ...stamp },
    });

    const perOrder = new Map<string, number>();
    for (const item of toChange) perOrder.set(item.orderId, (perOrder.get(item.orderId) ?? 0) + 1);
    for (const [orderId, count] of perOrder) {
      await writeAudit(tx, {
        actorId: actor.id,
        action: "kitchen.items_status_changed",
        entityType: "Order",
        entityId: orderId,
        details: { from: input.from, to: input.to, items: count },
      });
    }
    return { changed: toChange.length };
  });
}

// ---------- printing ----------

export async function getTicket(id: string): Promise<KitchenTicketView & { sentByName: string }> {
  const row = await db.kitchenTicket.findUnique({ where: { id }, select: { ...TICKET_SELECT, sentBy: { select: { name: true } } } });
  if (!row) throw notFound();
  const { sentBy, ...ticket } = row;
  return { ...toTicketView(ticket), sentByName: sentBy.name };
}

/** Every print and reprint is counted and logged. Returns the new count. */
export async function recordTicketPrint(actor: AuthedStaff, ticketId: string): Promise<number> {
  if (!(await db.kitchenTicket.findUnique({ where: { id: ticketId }, select: { id: true } }))) throw notFound();

  return db.$transaction(async (tx) => {
    const { printCount, orderId } = await tx.kitchenTicket.update({
      where: { id: ticketId },
      data: { printCount: { increment: 1 } },
      select: { printCount: true, orderId: true },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "kitchen.ticket_printed",
      entityType: "KitchenTicket",
      entityId: ticketId,
      details: { count: printCount, orderId },
    });
    return printCount;
  });
}
