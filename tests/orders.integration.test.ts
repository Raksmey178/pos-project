import { beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled, setupIntegrationEnv, uniqueName } from "./integration-setup";

describe.skipIf(!integrationEnabled())("orders service (real database)", () => {
  let db: typeof import("@/server/db").db;
  let orders: typeof import("@/server/services/orders");
  let menu: typeof import("@/server/services/menu");
  let tables: typeof import("@/server/services/tables");
  let hashPin: typeof import("@/server/auth/pin").hashPin;
  let manager: { id: string; name: string; role: "MANAGER" };
  let waiter: { id: string; name: string; role: "WAITER" };

  beforeAll(async () => {
    setupIntegrationEnv();
    ({ db } = await import("@/server/db"));
    orders = await import("@/server/services/orders");
    menu = await import("@/server/services/menu");
    tables = await import("@/server/services/tables");
    ({ hashPin } = await import("@/server/auth/pin"));
    const m = await db.staff.create({ data: { name: uniqueName("ord-mgr"), role: "MANAGER", pinHash: await hashPin("483920") } });
    const w = await db.staff.create({ data: { name: uniqueName("ord-wtr"), role: "WAITER", pinHash: await hashPin("2580") } });
    manager = { id: m.id, name: m.name, role: "MANAGER" };
    waiter = { id: w.id, name: w.name, role: "WAITER" };
  });

  const failsWith = (promise: Promise<unknown>, code: string) => expect(promise).rejects.toMatchObject({ code });
  const uuid = () => crypto.randomUUID();

  /** A little restaurant: one zone with some tables, and a menu with required and optional options. */
  async function restaurant() {
    const zone = await tables.createZone(manager, { name: uniqueName("Zone") });
    const mkTable = (extra = {}) => tables.createTable(manager, { zoneId: zone.id, name: uniqueName("T"), capacity: 4, shape: "RECT", width: 2, height: 2, ...extra });
    const [t1, t2, t3] = [await mkTable(), await mkTable(), await mkTable()];

    const station = await menu.createStation(manager, { name: uniqueName("Bar") });
    const category = await menu.createCategory(manager, { nameKm: uniqueName("Cat") });
    const size = await menu.createModifierGroup(manager, { nameKm: uniqueName("Size"), minSelect: 1, maxSelect: 1 });
    const small = await menu.createModifierOption(manager, size.id, { nameKm: "S", priceDeltaCents: 0 });
    const large = await menu.createModifierOption(manager, size.id, { nameKm: "L", priceDeltaCents: 100 });
    const extras = await menu.createModifierGroup(manager, { nameKm: uniqueName("Extras"), minSelect: 0, maxSelect: 2 });
    const egg = await menu.createModifierOption(manager, extras.id, { nameKm: "Egg", priceDeltaCents: 50 });
    const cheese = await menu.createModifierOption(manager, extras.id, { nameKm: "Cheese", priceDeltaCents: 75 });
    const bacon = await menu.createModifierOption(manager, extras.id, { nameKm: "Bacon", priceDeltaCents: 100 });
    const coffee = await menu.createMenuItem(manager, {
      categoryId: category.id, stationId: station.id, nameKm: uniqueName("Coffee"), priceCents: 350, modifierGroupIds: [size.id, extras.id],
    });
    const water = await menu.createMenuItem(manager, { categoryId: category.id, stationId: station.id, nameKm: uniqueName("Water"), priceCents: 50 });
    return { zone, t1, t2, t3, station, category, size, small, large, extras, egg, cheese, bacon, coffee, water, mkTable };
  }

  const dineIn = (tableIds: string[], extra = {}) => orders.createOrder(waiter, { clientOrderId: uuid(), type: "DINE_IN", tableIds, ...extra });
  const takeaway = () => orders.createOrder(waiter, { clientOrderId: uuid(), type: "TAKEAWAY" });
  const item = (menuItemId: string, optionIds: string[] = [], extra = {}) => ({ clientItemId: uuid(), menuItemId, quantity: 1, optionIds, ...extra });
  const tableStatus = async (zoneId: string, tableId: string) => (await tables.getFloorPlan()).zones.find((z) => z.id === zoneId)!.tables.find((t) => t.id === tableId)!;

  describe("opening an order", () => {
    it("a dine-in order occupies its table, and the floor plan shows it", async () => {
      const r = await restaurant();
      expect((await tableStatus(r.zone.id, r.t1.id)).status).toBe("AVAILABLE");

      const { order, created } = await dineIn([r.t1.id], { guestCount: 3 });
      expect(created).toBe(true);
      expect(order).toMatchObject({ type: "DINE_IN", status: "OPEN", guestCount: 3, items: [], subtotalCents: 0 });
      expect(order.tables.map((t) => t.id)).toEqual([r.t1.id]);
      expect(order.openedBy.id).toBe(waiter.id);

      const shown = await tableStatus(r.zone.id, r.t1.id);
      expect(shown).toMatchObject({ status: "OCCUPIED", orderId: order.id });
      expect((await tableStatus(r.zone.id, r.t2.id)).status).toBe("AVAILABLE");
    });

    it("sending the same request twice gives the same order, never a second one", async () => {
      const r = await restaurant();
      const clientOrderId = uuid();
      const first = await orders.createOrder(waiter, { clientOrderId, type: "DINE_IN", tableIds: [r.t1.id] });
      const second = await orders.createOrder(waiter, { clientOrderId, type: "DINE_IN", tableIds: [r.t1.id] });
      expect(second.created).toBe(false);
      expect(second.order.id).toBe(first.order.id);
      expect(await db.order.count({ where: { clientOrderId } })).toBe(1);

      const concurrent = await Promise.all(Array.from({ length: 4 }, () => orders.createOrder(waiter, { clientOrderId: uuid(), type: "TAKEAWAY" })));
      expect(new Set(concurrent.map((c) => c.order.id)).size).toBe(4);
    });

    it("one open order per table: a second order on the same table is refused", async () => {
      const r = await restaurant();
      await dineIn([r.t1.id]);
      await failsWith(dineIn([r.t1.id]), "TABLE_IN_USE");
    });

    it("two waiters opening the same table at the same moment: exactly one wins", async () => {
      const r = await restaurant();
      const results = await Promise.allSettled([dineIn([r.t1.id]), dineIn([r.t1.id])]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect((results.find((x) => x.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "TABLE_IN_USE" });
      expect(await db.orderTable.count({ where: { tableId: r.t1.id, releasedAt: null } })).toBe(1);
    });

    it("the database itself refuses two occupying rows for one table", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      const other = await takeaway();
      await expect(db.orderTable.create({ data: { orderId: other.order.id, tableId: r.t1.id } })).rejects.toThrow();
      expect(order.tables).toHaveLength(1);
    });

    it("needs real, active tables", async () => {
      const r = await restaurant();
      await failsWith(dineIn([uuid()]), "INVALID_INPUT");
      await tables.updateTable(manager, r.t2.id, { isActive: false });
      await failsWith(dineIn([r.t2.id]), "INVALID_INPUT");
    });

    it("takeaway and delivery need no table and keep the customer details", async () => {
      const { order } = await orders.createOrder(waiter, {
        clientOrderId: uuid(), type: "DELIVERY", customerName: "Sokha", customerPhone: "012 345 678", deliveryAddress: "Street 1",
      });
      expect(order).toMatchObject({ type: "DELIVERY", customerName: "Sokha", customerPhone: "012 345 678", deliveryAddress: "Street 1", tables: [] });
    });

    it("order numbers are 1, 2, 3 ... without gaps, even when created at the same time", async () => {
      const made = await Promise.all(Array.from({ length: 8 }, () => takeaway()));
      const numbers = made.map((m) => m.order.orderNumber).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(8);
      expect(numbers[7] - numbers[0]).toBe(7);
      expect(made[0].order.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("items", () => {
    it("copies name, price and options into the order and totals them with the money module", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      const updated = await orders.addItem(waiter, order.id, item(r.coffee.id, [r.large.id, r.egg.id], { quantity: 2, note: "less ice" }));

      expect(updated.items).toHaveLength(1);
      const line = updated.items[0];
      expect(line).toMatchObject({ unitPriceCents: 350, quantity: 2, note: "less ice", status: "NEW", nameKm: r.coffee.nameKm });
      expect(line.modifiers.map((m) => m.priceDeltaCents).sort()).toEqual([100, 50]);
      expect(line.lineTotalCents).toBe((350 + 100 + 50) * 2); // 1000
      expect(updated.subtotalCents).toBe(1000);

      const second = await orders.addItem(waiter, order.id, item(r.water.id, [], { quantity: 3 }));
      expect(second.subtotalCents).toBe(1000 + 150);
    });

    it("a later menu change never changes what was already ordered", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await orders.addItem(waiter, order.id, item(r.coffee.id, [r.small.id]));

      await menu.updateMenuItem(manager, r.coffee.id, { priceCents: 999, nameKm: uniqueName("Renamed") });
      await menu.updateModifierOption(manager, r.small.id, { priceDeltaCents: 500, nameKm: "Tiny" });

      const view = await orders.getOrder(order.id);
      expect(view.items[0].unitPriceCents).toBe(350);
      expect(view.items[0].nameKm).toBe(r.coffee.nameKm);
      expect(view.items[0].modifiers[0]).toMatchObject({ nameKm: "S", priceDeltaCents: 0 });
      expect(view.subtotalCents).toBe(350);
    });

    it("checks the options against the item's rules", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      const add = (optionIds: string[]) => orders.addItem(waiter, order.id, item(r.coffee.id, optionIds));

      await failsWith(add([]), "INVALID_INPUT"); // size is required
      await failsWith(add([r.small.id, r.large.id]), "INVALID_INPUT"); // only one size
      await failsWith(add([r.small.id, r.egg.id, r.cheese.id, r.bacon.id]), "INVALID_INPUT"); // max 2 extras
      await failsWith(add([r.small.id, r.egg.id, r.egg.id]), "INVALID_INPUT"); // duplicate
      await failsWith(add([r.small.id, uuid()]), "INVALID_INPUT"); // unknown option
      await failsWith(orders.addItem(waiter, order.id, item(r.water.id, [r.small.id])), "INVALID_INPUT"); // water has no options
      await add([r.small.id, r.egg.id, r.cheese.id]);
      expect((await orders.getOrder(order.id)).items).toHaveLength(1);
    });

    it("sold-out, switched-off and unknown items cannot be ordered", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);

      await menu.setItemSoldOut(manager, r.water.id, true);
      await failsWith(orders.addItem(waiter, order.id, item(r.water.id)), "ITEM_SOLD_OUT");
      await menu.setItemSoldOut(manager, r.water.id, false);
      await orders.addItem(waiter, order.id, item(r.water.id));

      await menu.updateMenuItem(manager, r.water.id, { isActive: false });
      await failsWith(orders.addItem(waiter, order.id, item(r.water.id)), "INVALID_INPUT");
      await menu.updateMenuItem(manager, r.water.id, { isActive: true });
      await menu.updateCategory(manager, r.category.id, { isActive: false });
      await failsWith(orders.addItem(waiter, order.id, item(r.water.id)), "INVALID_INPUT");
      await failsWith(orders.addItem(waiter, order.id, item(uuid())), "INVALID_INPUT");
    });

    it("an inactive option group or option is ignored, so it cannot block the order", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await menu.updateModifierGroup(manager, r.size.id, { isActive: false }); // required group switched off
      await orders.addItem(waiter, order.id, item(r.coffee.id, []));
      await failsWith(orders.addItem(waiter, order.id, item(r.coffee.id, [r.small.id])), "INVALID_INPUT"); // its options are not offered any more
    });

    it("sending the same item twice never adds it twice", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      const request = item(r.water.id, [], { quantity: 2 });

      await orders.addItem(waiter, order.id, request);
      const again = await orders.addItem(waiter, order.id, request);
      expect(again.items).toHaveLength(1);

      const burst = item(r.water.id);
      const results = await Promise.all(Array.from({ length: 5 }, () => orders.addItem(waiter, order.id, burst)));
      expect(results.every((view) => view.items.length === 2)).toBe(true);
      expect(await db.orderItem.count({ where: { orderId: order.id } })).toBe(2);
    });

    it("the same client id used on a different order is a conflict", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      const b = await dineIn([r.t2.id]);
      const request = item(r.water.id);
      await orders.addItem(waiter, a.order.id, request);
      await failsWith(orders.addItem(waiter, b.order.id, request), "CONFLICT");
    });

    it("removing an item keeps it in the history, and a late retry of the add does not bring it back", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      const request = item(r.water.id, [], { quantity: 2 });
      const added = await orders.addItem(waiter, order.id, request);
      const itemId = added.items[0].id;

      const removed = await orders.removeItem(waiter, order.id, itemId);
      expect(removed.items).toHaveLength(0);
      expect(removed.subtotalCents).toBe(0);
      expect((await orders.removeItem(waiter, order.id, itemId)).items).toHaveLength(0); // second click: nothing happens

      const row = await db.orderItem.findUniqueOrThrow({ where: { id: itemId } });
      expect(row.removedAt).not.toBeNull();
      expect(row.removedById).toBe(waiter.id);

      expect((await orders.addItem(waiter, order.id, request)).items).toHaveLength(0); // late retry
      await failsWith(orders.removeItem(waiter, order.id, uuid()), "NOT_FOUND");
    });
  });

  describe("bill and cancel", () => {
    it("the bill cannot be requested on an empty order; adding an item reopens it", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await failsWith(orders.setBillRequested(waiter, order.id, true), "INVALID_INPUT");

      await orders.addItem(waiter, order.id, item(r.water.id));
      const billed = await orders.setBillRequested(waiter, order.id, true);
      expect(billed.status).toBe("BILL_REQUESTED");
      expect((await tableStatus(r.zone.id, r.t1.id)).status).toBe("BILL_REQUESTED");
      expect((await orders.setBillRequested(waiter, order.id, true)).status).toBe("BILL_REQUESTED"); // repeat: fine

      const reopened = await orders.addItem(waiter, order.id, item(r.water.id));
      expect(reopened.status).toBe("OPEN");
      expect((await tableStatus(r.zone.id, r.t1.id)).status).toBe("OCCUPIED");

      await orders.setBillRequested(waiter, order.id, true);
      expect((await orders.setBillRequested(waiter, order.id, false)).status).toBe("OPEN");
    });

    it("an empty order can be cancelled and frees its table; one with items cannot", async () => {
      const r = await restaurant();
      const mistake = await dineIn([r.t1.id]);
      const cancelled = await orders.cancelEmptyOrder(waiter, mistake.order.id);
      expect(cancelled.status).toBe("VOIDED");
      expect((await tableStatus(r.zone.id, r.t1.id)).status).toBe("AVAILABLE");
      await dineIn([r.t1.id]); // the table can be used again

      const busy = await dineIn([r.t2.id]);
      await orders.addItem(waiter, busy.order.id, item(r.water.id));
      await failsWith(orders.cancelEmptyOrder(waiter, busy.order.id), "ORDER_NOT_EMPTY");
    });

    it("a closed order cannot be changed any more", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await orders.cancelEmptyOrder(waiter, order.id);
      await failsWith(orders.addItem(waiter, order.id, item(r.water.id)), "ORDER_CLOSED");
      await failsWith(orders.setBillRequested(waiter, order.id, true), "ORDER_CLOSED");
      await failsWith(orders.cancelEmptyOrder(waiter, order.id), "ORDER_CLOSED");
      await failsWith(orders.transferTable(waiter, order.id, r.t1.id, r.t2.id), "ORDER_CLOSED");
    });

    it("a table with an open order cannot be switched off", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await failsWith(tables.updateTable(manager, r.t1.id, { isActive: false }), "TABLE_IN_USE");
      await orders.cancelEmptyOrder(waiter, order.id);
      await tables.updateTable(manager, r.t1.id, { isActive: false });
    });
  });

  describe("transfer", () => {
    it("moves the guests to a free table", async () => {
      const r = await restaurant();
      const { order } = await dineIn([r.t1.id]);
      await orders.addItem(waiter, order.id, item(r.water.id));

      const moved = await orders.transferTable(waiter, order.id, r.t1.id, r.t2.id);
      expect(moved.tables.map((t) => t.id)).toEqual([r.t2.id]);
      expect(moved.items).toHaveLength(1);
      expect((await tableStatus(r.zone.id, r.t1.id)).status).toBe("AVAILABLE");
      expect(await tableStatus(r.zone.id, r.t2.id)).toMatchObject({ status: "OCCUPIED", orderId: order.id });
    });

    it("refuses an occupied table, the same table, a table not on the order, and other order types", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      await dineIn([r.t2.id]);
      await failsWith(orders.transferTable(waiter, a.order.id, r.t1.id, r.t2.id), "TABLE_IN_USE");
      await failsWith(orders.transferTable(waiter, a.order.id, r.t1.id, r.t1.id), "INVALID_INPUT");
      await failsWith(orders.transferTable(waiter, a.order.id, r.t3.id, r.t2.id), "INVALID_INPUT");

      const away = await takeaway();
      await failsWith(orders.transferTable(waiter, away.order.id, r.t1.id, r.t3.id), "INVALID_INPUT");

      await tables.updateTable(manager, r.t3.id, { isActive: false });
      await failsWith(orders.transferTable(waiter, a.order.id, r.t1.id, r.t3.id), "INVALID_INPUT");
    });

    it("two orders moving to the same table at the same moment: exactly one wins", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      const b = await dineIn([r.t2.id]);
      const results = await Promise.allSettled([
        orders.transferTable(waiter, a.order.id, r.t1.id, r.t3.id),
        orders.transferTable(waiter, b.order.id, r.t2.id, r.t3.id),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect((results.find((x) => x.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "TABLE_IN_USE" });
      expect(await db.orderTable.count({ where: { tableId: r.t3.id, releasedAt: null } })).toBe(1);
    });
  });

  describe("merge", () => {
    it("moves the items and tables of one order into the other", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id], { guestCount: 2 });
      const b = await dineIn([r.t2.id], { guestCount: 3 });
      await orders.addItem(waiter, a.order.id, item(r.water.id));
      await orders.addItem(waiter, b.order.id, item(r.coffee.id, [r.small.id]));
      await orders.setBillRequested(waiter, a.order.id, true);

      const merged = await orders.mergeOrders(waiter, a.order.id, b.order.id);
      expect(merged.items).toHaveLength(2);
      expect(merged.subtotalCents).toBe(50 + 350);
      expect(merged.tables.map((t) => t.id).sort()).toEqual([r.t1.id, r.t2.id].sort());
      expect(merged.guestCount).toBe(5);
      expect(merged.status).toBe("OPEN"); // new items: the bill is not requested any more

      const source = await orders.getOrder(b.order.id);
      expect(source).toMatchObject({ status: "MERGED", mergedIntoId: a.order.id, mergedIntoNumber: a.order.orderNumber, items: [], tables: [] });

      expect(await tableStatus(r.zone.id, r.t1.id)).toMatchObject({ status: "OCCUPIED", orderId: a.order.id });
      expect(await tableStatus(r.zone.id, r.t2.id)).toMatchObject({ status: "OCCUPIED", orderId: a.order.id });
    });

    it("refuses merging an order with itself, a takeaway, or a closed order", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      const b = await dineIn([r.t2.id]);
      const away = await takeaway();
      await failsWith(orders.mergeOrders(waiter, a.order.id, a.order.id), "INVALID_INPUT");
      await failsWith(orders.mergeOrders(waiter, a.order.id, away.order.id), "INVALID_INPUT");
      await failsWith(orders.mergeOrders(waiter, away.order.id, a.order.id), "INVALID_INPUT");

      await orders.cancelEmptyOrder(waiter, b.order.id);
      await failsWith(orders.mergeOrders(waiter, a.order.id, b.order.id), "ORDER_CLOSED");
      await failsWith(orders.mergeOrders(waiter, uuid(), a.order.id), "NOT_FOUND");
    });

    it("a merged order cannot be merged again, and the merged tables can be transferred one by one", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      const b = await dineIn([r.t2.id]);
      await orders.mergeOrders(waiter, a.order.id, b.order.id);
      await failsWith(orders.mergeOrders(waiter, a.order.id, b.order.id), "ORDER_CLOSED");

      const moved = await orders.transferTable(waiter, a.order.id, r.t2.id, r.t3.id);
      expect(moved.tables.map((t) => t.id).sort()).toEqual([r.t1.id, r.t3.id].sort());
      expect((await tableStatus(r.zone.id, r.t2.id)).status).toBe("AVAILABLE");
    });

    it("two merges into the same order at the same moment both work, and no table is lost", async () => {
      const r = await restaurant();
      const a = await dineIn([r.t1.id]);
      const b = await dineIn([r.t2.id]);
      const c = await dineIn([r.t3.id]);
      const results = await Promise.all([orders.mergeOrders(waiter, a.order.id, b.order.id), orders.mergeOrders(waiter, a.order.id, c.order.id)]);
      expect(results).toHaveLength(2);
      const final = await orders.getOrder(a.order.id);
      expect(final.tables).toHaveLength(3);
    });
  });

  it("the open-orders list shows tables and subtotals, and leaves out closed and merged orders", async () => {
    const r = await restaurant();
    const open = await dineIn([r.t1.id]);
    await orders.addItem(waiter, open.order.id, item(r.water.id, [], { quantity: 3 }));
    const cancelled = await dineIn([r.t2.id]);
    await orders.cancelEmptyOrder(waiter, cancelled.order.id);
    const merged = await dineIn([r.t3.id]);
    await orders.mergeOrders(waiter, open.order.id, merged.order.id);

    const list = await orders.listOpenOrders();
    const entry = list.find((o) => o.id === open.order.id)!;
    expect(entry).toMatchObject({ itemCount: 3, subtotalCents: 150, status: "OPEN", type: "DINE_IN" });
    expect(entry.tableNames).toHaveLength(2);
    expect(list.find((o) => o.id === cancelled.order.id)).toBeUndefined();
    expect(list.find((o) => o.id === merged.order.id)).toBeUndefined();
  });

  it("every step is written to the audit log by the person who did it", async () => {
    const r = await restaurant();
    const a = await dineIn([r.t1.id]);
    const b = await dineIn([r.t2.id]);
    const added = await orders.addItem(waiter, a.order.id, item(r.water.id));
    await orders.removeItem(waiter, a.order.id, added.items[0].id);
    await orders.transferTable(waiter, a.order.id, r.t1.id, r.t3.id);
    await orders.mergeOrders(waiter, a.order.id, b.order.id);

    for (const action of ["orders.order_created", "orders.item_added", "orders.item_removed", "orders.table_transferred", "orders.merged"]) {
      const row = await db.auditLog.findFirstOrThrow({ where: { entityId: a.order.id, action } });
      expect(row.actorId).toBe(waiter.id);
    }
  });
});
