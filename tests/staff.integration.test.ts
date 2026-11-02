import { beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/lib/roles";
import { integrationEnabled, setupIntegrationEnv, uniqueName } from "./integration-setup";

describe.skipIf(!integrationEnabled())("staff service (real database)", () => {
  let db: typeof import("@/server/db").db;
  let auth: typeof import("@/server/services/auth");
  let staffService: typeof import("@/server/services/staff");
  let hashPin: typeof import("@/server/auth/pin").hashPin;

  beforeAll(async () => {
    setupIntegrationEnv();
    ({ db } = await import("@/server/db"));
    auth = await import("@/server/services/auth");
    staffService = await import("@/server/services/staff");
    ({ hashPin } = await import("@/server/auth/pin"));
  });

  async function makeActor(role: Role, pin: string) {
    const row = await db.staff.create({ data: { name: uniqueName(role), role, pinHash: await hashPin(pin) } });
    return { id: row.id, name: row.name, role };
  }
  const failsWith = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code });
  const auditCount = (entityId: string, action: string) =>
    db.auditLog.count({ where: { entityId, action } });

  describe("creating staff", () => {
    it("a Manager can add a Waiter; the PIN is stored only as a hash", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const created = await staffService.createStaff(manager, { name: uniqueName("w"), role: "WAITER", pin: "2580" });

      expect(created).toMatchObject({ role: "WAITER", isActive: true, isLocked: false });
      expect(created).not.toHaveProperty("pinHash");
      const stored = await db.staff.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.pinHash).toMatch(/^\$argon2id\$/);
      expect(stored.pinHash).not.toContain("2580");
      expect(await auditCount(created.id, "staff.create")).toBe(1);

      await auth.login({ staffId: created.id, pin: "2580" }); // and the new waiter can log in
    });

    it("a Manager can NOT create a Manager or an Admin; an Admin can", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const admin = await makeActor("ADMIN", "483920");
      await failsWith(staffService.createStaff(manager, { name: uniqueName("m"), role: "MANAGER", pin: "483920" }), "FORBIDDEN");
      await failsWith(staffService.createStaff(manager, { name: uniqueName("a"), role: "ADMIN", pin: "483920" }), "FORBIDDEN");
      await staffService.createStaff(admin, { name: uniqueName("m"), role: "MANAGER", pin: "483920" });
    });

    it("floor staff cannot create anyone", async () => {
      const waiter = await makeActor("WAITER", "2580");
      await failsWith(staffService.createStaff(waiter, { name: uniqueName("w"), role: "WAITER", pin: "4829" }), "FORBIDDEN");
    });

    it("rejects weak PINs and PINs of the wrong length", async () => {
      const manager = await makeActor("MANAGER", "483920");
      await failsWith(staffService.createStaff(manager, { name: uniqueName("w"), role: "WAITER", pin: "1234" }), "WEAK_PIN");
      await failsWith(staffService.createStaff(manager, { name: uniqueName("w"), role: "WAITER", pin: "482901" }), "INVALID_INPUT");
    });

    it("rejects a name that already exists", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const name = uniqueName("dup");
      await staffService.createStaff(manager, { name, role: "WAITER", pin: "2580" });
      await failsWith(staffService.createStaff(manager, { name, role: "CASHIER", pin: "4829" }), "CONFLICT");
    });
  });

  describe("changing staff", () => {
    it("a Manager cannot touch an Admin or another Manager", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const admin = await makeActor("ADMIN", "483920");
      const otherManager = await makeActor("MANAGER", "102938");
      await failsWith(staffService.updateStaff(manager, admin.id, { isActive: false }), "FORBIDDEN");
      await failsWith(staffService.updateStaff(manager, otherManager.id, { name: uniqueName("x") }), "FORBIDDEN");
      await failsWith(staffService.resetStaffPin(manager, admin.id, "573819"), "FORBIDDEN");
      await failsWith(staffService.unlockStaff(manager, admin.id), "FORBIDDEN");
      await failsWith(staffService.revokeStaffSessions(manager, admin.id), "FORBIDDEN");
    });

    it("nobody can deactivate or demote themselves", async () => {
      const admin = await makeActor("ADMIN", "483920");
      await failsWith(staffService.updateStaff(admin, admin.id, { isActive: false }), "FORBIDDEN");
      await failsWith(staffService.updateStaff(admin, admin.id, { role: "WAITER", pin: "2580" }), "FORBIDDEN");
    });

    it("unknown id is NOT_FOUND", async () => {
      const admin = await makeActor("ADMIN", "483920");
      await failsWith(staffService.updateStaff(admin, crypto.randomUUID(), { name: "x" }), "NOT_FOUND");
    });

    it("deactivating ends their logins at once, and reactivating is logged", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      const { token } = await auth.login({ staffId: waiter.id, pin: "2580" });

      await staffService.updateStaff(manager, waiter.id, { isActive: false });
      expect(await auth.findStaffBySessionToken(token)).toBeNull();
      await failsWith(auth.login({ staffId: waiter.id, pin: "2580" }), "INVALID_CREDENTIALS");
      expect(await auditCount(waiter.id, "staff.deactivated")).toBe(1);

      await staffService.updateStaff(manager, waiter.id, { isActive: true });
      await auth.login({ staffId: waiter.id, pin: "2580" });
      expect(await auditCount(waiter.id, "staff.activated")).toBe(1);
    });

    it("renaming is logged, and a taken name is a CONFLICT", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const a = await makeActor("WAITER", "2580");
      const b = await makeActor("WAITER", "4829");
      const newName = uniqueName("renamed");
      const row = await staffService.updateStaff(manager, a.id, { name: newName });
      expect(row.name).toBe(newName);
      expect(await auditCount(a.id, "staff.renamed")).toBe(1);
      await failsWith(staffService.updateStaff(manager, b.id, { name: newName }), "CONFLICT");
    });

    it("an Admin changing a role needs a PIN of the new length, and the old logins end", async () => {
      const admin = await makeActor("ADMIN", "483920");
      const waiter = await makeActor("WAITER", "2580");
      const { token } = await auth.login({ staffId: waiter.id, pin: "2580" });

      await failsWith(staffService.updateStaff(admin, waiter.id, { role: "MANAGER" }), "INVALID_INPUT"); // 6-digit PIN missing
      await failsWith(staffService.updateStaff(admin, waiter.id, { role: "MANAGER", pin: "2580" }), "INVALID_INPUT"); // wrong length
      await failsWith(staffService.updateStaff(admin, waiter.id, { pin: "483920" }), "INVALID_INPUT"); // pin without role change

      const row = await staffService.updateStaff(admin, waiter.id, { role: "MANAGER", pin: "573819" });
      expect(row.role).toBe("MANAGER");
      expect(await auth.findStaffBySessionToken(token)).toBeNull();
      await auth.login({ staffId: waiter.id, pin: "573819" });
      expect(await auditCount(waiter.id, "staff.role_changed")).toBe(1);
    });

    it("moving between roles with the same PIN length keeps the PIN", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      const row = await staffService.updateStaff(manager, waiter.id, { role: "CASHIER" });
      expect(row.role).toBe("CASHIER");
      await auth.login({ staffId: waiter.id, pin: "2580" });
    });
  });

  describe("PIN reset, unlock and sign-out", () => {
    it("a Manager resets a Waiter's PIN: old PIN stops, lock clears, logins end", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      const { token } = await auth.login({ staffId: waiter.id, pin: "2580" });
      await db.staff.update({ where: { id: waiter.id }, data: { failedPinAttempts: 2, lockedUntil: new Date(Date.now() + 600_000) } });

      await staffService.resetStaffPin(manager, waiter.id, "4829");

      expect(await auth.findStaffBySessionToken(token)).toBeNull();
      await failsWith(auth.login({ staffId: waiter.id, pin: "2580" }), "INVALID_CREDENTIALS");
      await auth.login({ staffId: waiter.id, pin: "4829" });
      expect(await auditCount(waiter.id, "staff.pin_reset")).toBe(1);
    });

    it("rejects weak PINs, and nobody resets their own PIN this way", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      await failsWith(staffService.resetStaffPin(manager, waiter.id, "1234"), "WEAK_PIN");
      await failsWith(staffService.resetStaffPin(manager, manager.id, "573819"), "FORBIDDEN");
    });

    it("unlock clears a locked account", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      for (let i = 0; i < 5; i++) await auth.login({ staffId: waiter.id, pin: "9999" }).catch(() => undefined);
      await failsWith(auth.login({ staffId: waiter.id, pin: "2580" }), "ACCOUNT_LOCKED");

      await staffService.unlockStaff(manager, waiter.id);
      await auth.login({ staffId: waiter.id, pin: "2580" });
      expect(await auditCount(waiter.id, "staff.unlocked")).toBe(1);
    });

    it("ending sessions signs the person out everywhere and reports how many", async () => {
      const manager = await makeActor("MANAGER", "483920");
      const waiter = await makeActor("WAITER", "2580");
      const one = await auth.login({ staffId: waiter.id, pin: "2580" });
      const two = await auth.login({ staffId: waiter.id, pin: "2580" });

      expect(await staffService.revokeStaffSessions(manager, waiter.id)).toBe(2);
      expect(await auth.findStaffBySessionToken(one.token)).toBeNull();
      expect(await auth.findStaffBySessionToken(two.token)).toBeNull();
    });
  });

  it("the staff list never includes PIN hashes", async () => {
    const rows = await staffService.listStaff();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "isActive", "isLocked", "name", "role"]);
    }
  });
});
