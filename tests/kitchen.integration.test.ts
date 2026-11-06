import { beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled, setupIntegrationEnv, uniqueName } from "./integration-setup";

describe.skipIf(!integrationEnabled())("kitchen service (real database)", () => {
  let db: typeof import("@/server/db").db;
  let orders: typeof import("@/server/services/orders");
  let kitchen: typeof import("@/server/services/kitchen");
  let menu: typeof import("@/server/services/menu");
  let tables: typeof import("@/server/services/tables");
  let hashPin: typeof import("@/server/auth/pin").hashPin;
  let manager: { id: string; name: string; role: "MANAGER" };
  let waiter: { id: string; name: string; role: "WAITER" };
  let cook: { id: string; name: string; role: "KITCHEN" };

  beforeAll(async () => {
    setupIntegrationEnv();
    ({ db } = await import("@/server/db"));
    orders = await import("@/server/services/orders");
    kitchen = await import("@/server/services/kitchen");
    menu = await import("@/server/services/menu");
    tables = await import("@/server/services/tables");
    ({ hashPin } = await import("@/server/auth/pin"));
    const mk = async (role: "MANAGER" | "WAITER" | "KITCHEN", pin: string) => {
      const row = await db.staff.create({ data: { name: uniqueName(`k-${role}`), role, pinHash: await hashPin(pin) } });
      return { id: row.id, name: row.name, role };
    };
    manager = (await mk("MANAGER", "483920")) as typeof manager;
    waiter = (await mk("WAITER", "2580")) as typeof waiter;
    cook = (await mk("KITCHEN", "4829")) as typeof cook;
  });

  const failsWith = (promise: Promise<unknown>, code: string) => expect(promise).rejects.toMatchObject({ code });
  const uuid = () => crypto.randomUUID();

  /** Two zones of work: a Kitchen station and a Bar station, a few dishes and drinks, and tables. */
  async function restaurant() {
    const zone = await tables.createZone(manager, { name: uniqueName("Zone") });
    const mkTable = () => tables.createTable(manager, { zoneId: zone.id, name: uniqueName("T"), capacity: 4, shape: "RECT", width: 2, height: 2 });
    const [t1, t2, t3] = [await mkTable(), await mkTable(), await mkTable()];
    const kitchenStation = await menu.createStation(manager, { name: uniqueName("Kitchen") });
    const bar = await menu.createStation(manager, { name: uniqueName("Bar") });
    const category = await menu.createCategory(manager, { nameKm: uniqueName("Cat") });
    const dish = (stationId: string, price: number) => menu.createMenuItem(manager, { categoryId: category.id, stationId, nameKm: uniqueName("Item"), priceCents: price });
    const noodles = await dish(kitchenStation.id, 450);
    const coffee = await dish(bar.id, 350);
    const tea = await dish(bar.id, 200);
    return { zone, t1, t2, t3, kitchenStation, bar, noodles, coffee, tea };
  }

  const open = (tableId: string) => orders.createOrder(waiter, { clientOrderId: uuid(), type: "DINE_IN", tableIds: [tableId] });
  const add = (orderId: string, menuItemId: string, quantity = 1) => orders.addItem(waiter, orderId, { clientItemId: uuid(), menuItemId, quantity, optionIds: [] });
  const send = (orderId: string, clientSendId = uuid()) => kitchen.sendToKitchen(waiter, orderId, clientSendId);
  const itemRows = (orderId: string) => db.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const ids = (view: { items: { id: string }[] }) => view.items.map((i) => i.id);

  describe("sending to the kitchen", () => {
    it("makes one ticket per station and marks the items as sent", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      await add(order.id, r.noodles.id, 2);
      const before = await add(order.id, r.tea.id);
      expect(before.unsentCount).toBe(3);

      const sent = await send(order.id);
      expect(sent.created).toBe(true);
      expect(sent.tickets).toHaveLength(2);
      expect(new Set(sent.tickets.map((t) => t.stationId))).toEqual(new Set([r.kitchenStation.id, r.bar.id]));
      expect(new Set(sent.tickets.map((t) => t.ticketNumber)).size).toBe(2);
      expect(sent.order.unsentCount).toBe(0);
      expect(sent.order.items.every((item) => item.sent && item.ticketNumber !== null && item.status === "NEW")).toBe(true);

      const rows = await itemRows(order.id);
      expect(rows.every((row) => row.ticketId !== null && row.sentAt !== null)).toBe(true);
      // both bar items share one ticket
      expect(new Set(rows.filter((row) => row.stationId === r.bar.id).map((row) => row.ticketId)).size).toBe(1);
    });

    it("sending the same request twice gives the same tickets, never new ones", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      const clientSendId = uuid();

      const first = await send(order.id, clientSendId);
      const again = await send(order.id, clientSendId);
      expect(again.created).toBe(false);
      expect(again.tickets.map((t) => t.id)).toEqual(first.tickets.map((t) => t.id));
      expect(await db.kitchenTicket.count({ where: { clientSendId } })).toBe(1);

      const { order: other } = await open(r.t2.id);
      await add(other.id, r.coffee.id);
      const burst = uuid();
      const results = await Promise.all(Array.from({ length: 4 }, () => send(other.id, burst)));
      expect(new Set(results.flatMap((x) => x.tickets.map((t) => t.id))).size).toBe(1);
      expect(await db.kitchenTicket.count({ where: { clientSendId: burst } })).toBe(1);
    });

    it("sending again later sends only the newer items; with nothing new it is refused", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      await send(order.id);
      await failsWith(send(order.id), "NOTHING_TO_SEND");

      await add(order.id, r.noodles.id);
      const second = await send(order.id);
      expect(second.tickets).toHaveLength(1);
      expect(second.tickets[0].stationId).toBe(r.kitchenStation.id);
      expect(await db.kitchenTicket.count({ where: { orderId: order.id } })).toBe(2);
    });

    it("an item removed before sending is not sent", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      const withItems = await add(order.id, r.coffee.id);
      await orders.removeItem(waiter, order.id, withItems.items[0].id);
      await failsWith(send(order.id), "NOTHING_TO_SEND");
    });

    it("the same client id cannot be used for another order, and closed or unknown orders are refused", async () => {
      const r = await restaurant();
      const a = await open(r.t1.id);
      const b = await open(r.t2.id);
      await add(a.order.id, r.coffee.id);
      await add(b.order.id, r.coffee.id);
      const clientSendId = uuid();
      await send(a.order.id, clientSendId);
      await failsWith(send(b.order.id, clientSendId), "CONFLICT");

      const empty = await open(r.t3.id);
      await orders.cancelEmptyOrder(waiter, empty.order.id);
      await failsWith(send(empty.order.id), "ORDER_CLOSED");
      await failsWith(send(uuid()), "NOT_FOUND");
    });

    it("ticket numbers go 1, 2, 3 ... without gaps, even when sent at the same time", async () => {
      const r = await restaurant();
      const made = await Promise.all(
        [r.t1, r.t2, r.t3].map(async (table) => {
          const { order } = await open(table.id);
          await add(order.id, r.coffee.id);
          return send(order.id);
        }),
      );
      const numbers = made.flatMap((m) => m.tickets.map((t) => t.ticketNumber)).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(3);
      expect(numbers[2] - numbers[0]).toBe(2);
    });

    it("an item that was sent can no longer be removed", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      const view = await add(order.id, r.coffee.id);
      await send(order.id);
      await failsWith(orders.removeItem(waiter, order.id, view.items[0].id), "ITEM_SENT");
      expect((await orders.getOrder(order.id)).items).toHaveLength(1);
    });
  });

  describe("item status", () => {
    async function sentOrder(r: Awaited<ReturnType<typeof restaurant>>, tableId: string) {
      const { order } = await open(tableId);
      await add(order.id, r.coffee.id);
      await add(order.id, r.tea.id);
      const sent = await send(order.id);
      return { order, itemIds: ids(sent.order) };
    }

    it("NEW -> PREPARING -> READY by the kitchen, READY -> SERVED by the floor, with time stamps", async () => {
      const r = await restaurant();
      const { order, itemIds } = await sentOrder(r, r.t1.id);

      expect(await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" })).toEqual({ changed: 2 });
      expect(await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "READY" })).toEqual({ changed: 2 });
      expect((await orders.getOrder(order.id)).readyCount).toBe(2);
      expect(await kitchen.setItemsStatus(waiter, { itemIds, from: "READY", to: "SERVED" })).toEqual({ changed: 2 });

      const rows = await itemRows(order.id);
      expect(rows.every((row) => row.status === "SERVED" && row.preparingAt && row.readyAt && row.servedAt)).toBe(true);
      expect((await orders.getOrder(order.id)).readyCount).toBe(0);
    });

    it("each role can only make its own steps", async () => {
      const r = await restaurant();
      const { itemIds } = await sentOrder(r, r.t1.id);

      await failsWith(kitchen.setItemsStatus(waiter, { itemIds, from: "NEW", to: "PREPARING" }), "FORBIDDEN");
      await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "READY" });
      await failsWith(kitchen.setItemsStatus(cook, { itemIds, from: "READY", to: "SERVED" }), "FORBIDDEN");
      await kitchen.setItemsStatus(manager, { itemIds, from: "READY", to: "SERVED" }); // a manager may do both
    });

    it("an undo step goes back one step and clears that step's time", async () => {
      const r = await restaurant();
      const { order, itemIds } = await sentOrder(r, r.t1.id);
      await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "READY" });

      await kitchen.setItemsStatus(cook, { itemIds, from: "READY", to: "PREPARING" });
      let rows = await itemRows(order.id);
      expect(rows.every((row) => row.status === "PREPARING" && row.readyAt === null && row.preparingAt !== null)).toBe(true);

      await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "NEW" });
      rows = await itemRows(order.id);
      expect(rows.every((row) => row.status === "NEW" && row.preparingAt === null)).toBe(true);
    });

    it("only single steps; items that were never sent cannot be changed", async () => {
      const r = await restaurant();
      const { itemIds } = await sentOrder(r, r.t1.id);
      await failsWith(kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "READY" }), "INVALID_INPUT");
      await failsWith(kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "NEW" }), "INVALID_INPUT");

      const { order: draft } = await open(r.t2.id);
      const view = await add(draft.id, r.coffee.id);
      await failsWith(kitchen.setItemsStatus(cook, { itemIds: ids(view), from: "NEW", to: "PREPARING" }), "INVALID_INPUT");
      await failsWith(kitchen.setItemsStatus(cook, { itemIds: [uuid()], from: "NEW", to: "PREPARING" }), "NOT_FOUND");
    });

    it("a stale screen cannot move a dish backwards: if someone else changed it first, the request is refused", async () => {
      const r = await restaurant();
      const { itemIds } = await sentOrder(r, r.t1.id);
      await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "READY" });

      // a screen that still shows the items as NEW presses "Start"
      await failsWith(kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" }), "STATUS_CHANGED");
      expect((await db.orderItem.findMany({ where: { id: { in: itemIds } } })).every((row) => row.status === "READY")).toBe(true);
    });

    it("items already at the target are left alone (pressing twice is harmless)", async () => {
      const r = await restaurant();
      const { itemIds } = await sentOrder(r, r.t1.id);
      await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" });
      expect(await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" })).toEqual({ changed: 0 });
    });

    it("a batch is all or nothing", async () => {
      const r = await restaurant();
      const a = await sentOrder(r, r.t1.id);
      const b = await sentOrder(r, r.t2.id);
      await kitchen.setItemsStatus(cook, { itemIds: [b.itemIds[0]], from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds: [b.itemIds[0]], from: "PREPARING", to: "READY" }); // now READY

      await failsWith(kitchen.setItemsStatus(cook, { itemIds: [...a.itemIds, b.itemIds[0]], from: "NEW", to: "PREPARING" }), "STATUS_CHANGED");
      const rows = await db.orderItem.findMany({ where: { id: { in: a.itemIds } } });
      expect(rows.every((row) => row.status === "NEW")).toBe(true); // nothing in the batch changed
    });

    it("two cooks pressing Start on the same dish at the same moment: it is started once", async () => {
      const r = await restaurant();
      const { itemIds } = await sentOrder(r, r.t1.id);
      const results = await Promise.all([
        kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" }),
        kitchen.setItemsStatus(manager, { itemIds, from: "NEW", to: "PREPARING" }),
      ]);
      expect(results.reduce((sum, x) => sum + x.changed, 0)).toBe(2); // each item changed exactly once, in total
      expect((await db.orderItem.findMany({ where: { id: { in: itemIds } } })).every((row) => row.status === "PREPARING")).toBe(true);
    });
  });

  describe("the board", () => {
    it("shows tickets with their order, tables and items, oldest first, and drops them when everything is served", async () => {
      const r = await restaurant();
      const a = await open(r.t1.id);
      await add(a.order.id, r.noodles.id, 2);
      const sentA = await send(a.order.id);
      const b = await open(r.t2.id);
      await add(b.order.id, r.coffee.id);
      const sentB = await send(b.order.id);

      let board = await kitchen.getKitchenBoard();
      const ticketA = board.tickets.find((t) => t.id === sentA.tickets[0].id)!;
      const ticketB = board.tickets.find((t) => t.id === sentB.tickets[0].id)!;
      expect(ticketA).toMatchObject({ orderId: a.order.id, orderNumber: a.order.orderNumber, orderType: "DINE_IN", stationId: r.kitchenStation.id });
      expect(ticketA.tableNames).toEqual([r.t1.name]);
      expect(ticketA.items).toHaveLength(1);
      expect(ticketA.items[0]).toMatchObject({ quantity: 2, status: "NEW", modifiers: [] });
      expect(board.tickets.indexOf(ticketA)).toBeLessThan(board.tickets.indexOf(ticketB)); // oldest first
      expect(board.stations.map((s) => s.id)).toEqual(expect.arrayContaining([r.kitchenStation.id, r.bar.id]));

      const itemIds = ids(sentA.order);
      await kitchen.setItemsStatus(cook, { itemIds, from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds, from: "PREPARING", to: "READY" });
      board = await kitchen.getKitchenBoard();
      expect(board.tickets.find((t) => t.id === ticketA.id)?.items[0].status).toBe("READY"); // waiting to be served

      await kitchen.setItemsStatus(waiter, { itemIds, from: "READY", to: "SERVED" });
      board = await kitchen.getKitchenBoard();
      expect(board.tickets.find((t) => t.id === ticketA.id)).toBeUndefined();
      expect(board.tickets.find((t) => t.id === ticketB.id)).toBeDefined();
    });

    it("does not show unsent drafts", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      const board = await kitchen.getKitchenBoard();
      expect(board.tickets.some((t) => t.orderId === order.id)).toBe(false);
    });

    it("after a merge the tickets show the surviving order and all its tables", async () => {
      const r = await restaurant();
      const a = await open(r.t1.id);
      const b = await open(r.t2.id);
      await add(b.order.id, r.noodles.id);
      const sent = await send(b.order.id);
      await orders.mergeOrders(waiter, a.order.id, b.order.id);

      const ticket = (await kitchen.getKitchenBoard()).tickets.find((t) => t.id === sent.tickets[0].id)!;
      expect(ticket.orderId).toBe(a.order.id);
      expect(ticket.orderNumber).toBe(a.order.orderNumber);
      expect(ticket.tableNames.sort()).toEqual([r.t1.name, r.t2.name].sort());
    });

    it("the order list and the order show how many items are ready to serve", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      await add(order.id, r.tea.id);
      const sent = await send(order.id);
      await kitchen.setItemsStatus(cook, { itemIds: [sent.order.items[0].id], from: "NEW", to: "PREPARING" });
      await kitchen.setItemsStatus(cook, { itemIds: [sent.order.items[0].id], from: "PREPARING", to: "READY" });

      expect((await orders.getOrder(order.id)).readyCount).toBe(1);
      expect((await orders.listOpenOrders()).find((o) => o.id === order.id)?.readyCount).toBe(1);
    });
  });

  describe("printing", () => {
    it("every print and reprint is counted and logged", async () => {
      const r = await restaurant();
      const { order } = await open(r.t1.id);
      await add(order.id, r.coffee.id);
      const sent = await send(order.id);
      const ticketId = sent.tickets[0].id;

      expect(await kitchen.recordTicketPrint(cook, ticketId)).toBe(1);
      expect(await kitchen.recordTicketPrint(waiter, ticketId)).toBe(2);
      const ticket = await kitchen.getTicket(ticketId);
      expect(ticket).toMatchObject({ printCount: 2, ticketNumber: sent.tickets[0].ticketNumber, orderNumber: order.orderNumber, sentByName: waiter.name });
      expect(await db.auditLog.count({ where: { entityId: ticketId, action: "kitchen.ticket_printed" } })).toBe(2);
      await failsWith(kitchen.recordTicketPrint(cook, uuid()), "NOT_FOUND");
      await failsWith(kitchen.getTicket(uuid()), "NOT_FOUND");
    });
  });

  it("every kitchen step is written to the audit log by the person who did it", async () => {
    const r = await restaurant();
    const { order } = await open(r.t1.id);
    await add(order.id, r.coffee.id);
    const sent = await send(order.id);
    await kitchen.setItemsStatus(cook, { itemIds: ids(sent.order), from: "NEW", to: "PREPARING" });

    const sentRow = await db.auditLog.findFirstOrThrow({ where: { entityId: order.id, action: "kitchen.sent" } });
    expect(sentRow.actorId).toBe(waiter.id);
    const stepRow = await db.auditLog.findFirstOrThrow({ where: { entityId: order.id, action: "kitchen.items_status_changed" } });
    expect(stepRow.actorId).toBe(cook.id);
    expect(stepRow.details).toMatchObject({ from: "NEW", to: "PREPARING", items: 1 });
  });
});
