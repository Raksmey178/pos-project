import { beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled, setupIntegrationEnv, uniqueName } from "./integration-setup";

describe.skipIf(!integrationEnabled())("tables service (real database)", () => {
  let db: typeof import("@/server/db").db;
  let tables: typeof import("@/server/services/tables");
  let hashPin: typeof import("@/server/auth/pin").hashPin;
  let actor: { id: string; name: string; role: "MANAGER" };

  beforeAll(async () => {
    setupIntegrationEnv();
    ({ db } = await import("@/server/db"));
    tables = await import("@/server/services/tables");
    ({ hashPin } = await import("@/server/auth/pin"));
    const row = await db.staff.create({ data: { name: uniqueName("tbl-mgr"), role: "MANAGER", pinHash: await hashPin("483920") } });
    actor = { id: row.id, name: row.name, role: "MANAGER" };
  });

  const failsWith = (promise: Promise<unknown>, code: string) => expect(promise).rejects.toMatchObject({ code });
  const newZone = () => tables.createZone(actor, { name: uniqueName("Zone") });
  const mk = (zoneId: string, extra: Partial<Parameters<typeof tables.createTable>[1]> = {}) =>
    tables.createTable(actor, { zoneId, name: uniqueName("T"), capacity: 4, shape: "RECT", width: 2, height: 2, ...extra });

  it("puts new tables in the first free spot, left to right", async () => {
    const zone = await newZone();
    const a = await mk(zone.id);
    const b = await mk(zone.id);
    const c = await mk(zone.id, { width: 3, height: 1 });
    expect([a.gridX, a.gridY]).toEqual([0, 0]);
    expect([b.gridX, b.gridY]).toEqual([2, 0]);
    expect([c.gridX, c.gridY]).toEqual([4, 0]);
    expect(a).toMatchObject({ status: "AVAILABLE", isActive: true, capacity: 4, shape: "RECT" });
  });

  it("an explicit position must fit the grid and must not overlap", async () => {
    const zone = await newZone();
    await mk(zone.id, { gridX: 4, gridY: 4 });
    await failsWith(mk(zone.id, { gridX: 5, gridY: 5 }), "TABLE_OVERLAP");
    await failsWith(mk(zone.id, { gridX: 23, gridY: 0 }), "INVALID_INPUT"); // sticks out on the right
    await failsWith(mk(zone.id, { gridX: 0, gridY: 15 }), "INVALID_INPUT"); // sticks out at the bottom
    await mk(zone.id, { gridX: 6, gridY: 4 }); // touching edges is fine
  });

  it("moving: free spot works, onto another table or off the plan is refused", async () => {
    const zone = await newZone();
    const a = await mk(zone.id);
    const b = await mk(zone.id);

    const moved = await tables.updateTable(actor, a.id, { gridX: 10, gridY: 5 });
    expect([moved.gridX, moved.gridY]).toEqual([10, 5]);

    await failsWith(tables.updateTable(actor, a.id, { gridX: b.gridX + 1, gridY: b.gridY }), "TABLE_OVERLAP");
    await failsWith(tables.updateTable(actor, a.id, { gridX: 23, gridY: 5 }), "INVALID_INPUT");
    await failsWith(tables.updateTable(actor, a.id, { gridY: 99 }), "INVALID_INPUT");
    await tables.updateTable(actor, a.id, { gridX: b.gridX + b.width, gridY: b.gridY }); // right next to it
  });

  it("making a table bigger cannot push it into its neighbour", async () => {
    const zone = await newZone();
    const a = await mk(zone.id);
    await mk(zone.id); // at x = 2
    await failsWith(tables.updateTable(actor, a.id, { width: 3 }), "TABLE_OVERLAP");
    await tables.updateTable(actor, a.id, { height: 4 });
  });

  it("table names are unique everywhere", async () => {
    const zone = await newZone();
    const other = await newZone();
    const a = await mk(zone.id);
    await failsWith(mk(other.id, { name: a.name }), "CONFLICT");
    const b = await mk(zone.id);
    await failsWith(tables.updateTable(actor, b.id, { name: a.name }), "CONFLICT");
  });

  it("a zone with active tables cannot be switched off; an inactive zone takes no new tables", async () => {
    const zone = await newZone();
    const table = await mk(zone.id);
    await failsWith(tables.updateZone(actor, zone.id, { isActive: false }), "ZONE_NOT_EMPTY");

    await tables.updateTable(actor, table.id, { isActive: false });
    await tables.updateZone(actor, zone.id, { isActive: false });
    await failsWith(mk(zone.id), "INVALID_INPUT");
    await failsWith(tables.updateTable(actor, table.id, { isActive: true }), "INVALID_INPUT"); // its zone is off
  });

  it("a switched-off table gives up its space, and cannot come back onto an occupied spot", async () => {
    const zone = await newZone();
    const a = await mk(zone.id);
    await tables.updateTable(actor, a.id, { isActive: false });

    const taker = await mk(zone.id, { gridX: a.gridX, gridY: a.gridY });
    await failsWith(tables.updateTable(actor, a.id, { isActive: true }), "TABLE_OVERLAP");

    await tables.updateTable(actor, taker.id, { gridX: 10, gridY: 10 });
    const back = await tables.updateTable(actor, a.id, { isActive: true });
    expect(back.isActive).toBe(true);
  });

  it("moving a table to another zone checks the space there", async () => {
    const from = await newZone();
    const to = await newZone();
    const table = await mk(from.id);
    await mk(to.id); // occupies (0,0) in the other zone

    await failsWith(tables.updateTable(actor, table.id, { zoneId: to.id }), "TABLE_OVERLAP");
    const moved = await tables.updateTable(actor, table.id, { zoneId: to.id, gridX: 10, gridY: 10 });
    expect(moved.zoneId).toBe(to.id);

    await tables.updateZone(actor, from.id, { isActive: false }); // it is empty now
    await failsWith(tables.updateTable(actor, table.id, { zoneId: from.id }), "INVALID_INPUT");
  });

  it("the waiter's floor plan shows only active zones and tables, all available", async () => {
    const zone = await newZone();
    const shown = await mk(zone.id);
    const hidden = await mk(zone.id);
    await tables.updateTable(actor, hidden.id, { isActive: false });
    const offZone = await newZone();
    await tables.updateZone(actor, offZone.id, { isActive: false });

    const plan = await tables.getFloorPlan();
    const planZone = plan.zones.find((z) => z.id === zone.id);
    expect(planZone?.tables.map((t) => t.id)).toEqual([shown.id]);
    expect(planZone?.tables[0].status).toBe("AVAILABLE");
    expect(plan.zones.find((z) => z.id === offZone.id)).toBeUndefined();

    const admin = await tables.getTablesAdminData();
    expect(admin.tables.find((t) => t.id === hidden.id)?.isActive).toBe(false);
    expect(admin.zones.find((z) => z.id === offZone.id)?.isActive).toBe(false);
  });

  it("reports a full zone", async () => {
    const zone = await newZone();
    for (let i = 0; i < 6; i++) await mk(zone.id, { width: 8, height: 8 }); // 3 x 2 of them fill the plan
    await failsWith(mk(zone.id, { width: 1, height: 1 }), "ZONE_FULL");
  });

  it("two managers adding a table at the same moment cannot take the same last spot", async () => {
    const zone = await newZone();
    for (let i = 0; i < 5; i++) await mk(zone.id, { width: 8, height: 8 }); // one 8x8 spot left

    const results = await Promise.allSettled([mk(zone.id, { width: 8, height: 8 }), mk(zone.id, { width: 8, height: 8 })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "ZONE_FULL" });

    const active = await db.diningTable.count({ where: { zoneId: zone.id, isActive: true } });
    expect(active).toBe(6);
  });

  it("two managers moving different tables onto the same spot cannot both succeed", async () => {
    const zone = await newZone();
    const a = await mk(zone.id, { gridX: 0, gridY: 0 });
    const b = await mk(zone.id, { gridX: 10, gridY: 0 });
    const results = await Promise.allSettled([
      tables.updateTable(actor, a.id, { gridX: 5, gridY: 8 }),
      tables.updateTable(actor, b.id, { gridX: 6, gridY: 8 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "TABLE_OVERLAP" });
  });

  it("unknown ids are NOT_FOUND", async () => {
    await failsWith(tables.updateTable(actor, crypto.randomUUID(), { name: "x" }), "NOT_FOUND");
    await failsWith(tables.updateZone(actor, crypto.randomUUID(), { name: "x" }), "NOT_FOUND");
  });

  it("every change is written to the audit log by the acting person", async () => {
    const zone = await newZone();
    const table = await mk(zone.id);
    await tables.updateTable(actor, table.id, { gridX: 10, gridY: 10 });
    await tables.updateZone(actor, zone.id, { sortOrder: 5 });

    for (const [entityId, action] of [
      [zone.id, "tables.zone_created"],
      [zone.id, "tables.zone_updated"],
      [table.id, "tables.table_created"],
      [table.id, "tables.table_updated"],
    ] as const) {
      const row = await db.auditLog.findFirstOrThrow({ where: { entityId, action } });
      expect(row.actorId).toBe(actor.id);
    }
    const moved = await db.auditLog.findFirstOrThrow({ where: { entityId: table.id, action: "tables.table_updated" } });
    expect(moved.details).toMatchObject({ fields: ["gridX", "gridY"] });
  });
});
