import { beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/lib/roles";
import { integrationEnabled, setupIntegrationEnv, uniqueName } from "./integration-setup";

describe.skipIf(!integrationEnabled())("auth service (real database)", () => {
  let db: typeof import("@/server/db").db;
  let auth: typeof import("@/server/services/auth");
  let hashPin: typeof import("@/server/auth/pin").hashPin;
  let hashSessionToken: typeof import("@/server/auth/session-token").hashSessionToken;

  beforeAll(async () => {
    setupIntegrationEnv();
    ({ db } = await import("@/server/db"));
    auth = await import("@/server/services/auth");
    ({ hashPin } = await import("@/server/auth/pin"));
    ({ hashSessionToken } = await import("@/server/auth/session-token"));
  });

  async function makeStaff(role: Role, pin: string) {
    return db.staff.create({ data: { name: uniqueName(role), role, pinHash: await hashPin(pin) } });
  }
  const failsWith = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code });

  it("logs in with the right PIN, stores only a hash of the token, and writes an audit row", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    const { token, staff } = await auth.login({ staffId: waiter.id, pin: "2580" });

    expect(staff).toEqual({ id: waiter.id, name: waiter.name, role: "WAITER" });
    expect(await auth.findStaffBySessionToken(token)).toEqual(staff);

    const session = await db.session.findFirstOrThrow({ where: { staffId: waiter.id } });
    expect(session.tokenHash).toBe(hashSessionToken(token));
    expect(session.tokenHash).not.toContain(token);

    const audit = await db.auditLog.findFirst({ where: { actorId: waiter.id, action: "auth.login" } });
    expect(audit).not.toBeNull();
  });

  it("a wrong PIN is refused, counted and logged", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    await failsWith(auth.login({ staffId: waiter.id, pin: "9999" }), "INVALID_CREDENTIALS");

    const after = await db.staff.findUniqueOrThrow({ where: { id: waiter.id } });
    expect(after.failedPinAttempts).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: waiter.id, action: "auth.login_failed" } })).toBe(1);
  });

  it("unknown and inactive accounts look exactly like a wrong PIN", async () => {
    await failsWith(auth.login({ staffId: crypto.randomUUID(), pin: "2580" }), "INVALID_CREDENTIALS");

    const gone = await makeStaff("WAITER", "2580");
    await db.staff.update({ where: { id: gone.id }, data: { isActive: false } });
    await failsWith(auth.login({ staffId: gone.id, pin: "2580" }), "INVALID_CREDENTIALS");
  });

  it("locks the account on the 5th wrong PIN, and then even the right PIN is refused", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    for (let i = 1; i <= 4; i++) {
      await failsWith(auth.login({ staffId: waiter.id, pin: "9999" }), "INVALID_CREDENTIALS");
    }
    await failsWith(auth.login({ staffId: waiter.id, pin: "9999" }), "ACCOUNT_LOCKED");
    await failsWith(auth.login({ staffId: waiter.id, pin: "2580" }), "ACCOUNT_LOCKED");

    const after = await db.staff.findUniqueOrThrow({ where: { id: waiter.id } });
    expect(after.lockedUntil).not.toBeNull();
    expect(after.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(await db.auditLog.count({ where: { entityId: waiter.id, action: "auth.account_locked" } })).toBe(1);
  });

  it("the lock ends by itself, and a good login resets the counter", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    await db.staff.update({
      where: { id: waiter.id },
      data: { failedPinAttempts: 3, lockedUntil: new Date(Date.now() - 1000) },
    });
    await auth.login({ staffId: waiter.id, pin: "2580" });

    const after = await db.staff.findUniqueOrThrow({ where: { id: waiter.id } });
    expect(after.failedPinAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });

  it("sessions stop working after logout, expiry, or switching the account off", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    const actor = { id: waiter.id, name: waiter.name, role: "WAITER" as const };

    const first = await auth.login({ staffId: waiter.id, pin: "2580" });
    await auth.logout(first.token, actor);
    expect(await auth.findStaffBySessionToken(first.token)).toBeNull();

    const second = await auth.login({ staffId: waiter.id, pin: "2580" });
    await db.session.updateMany({ where: { tokenHash: hashSessionToken(second.token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await auth.findStaffBySessionToken(second.token)).toBeNull();

    const third = await auth.login({ staffId: waiter.id, pin: "2580" });
    await db.staff.update({ where: { id: waiter.id }, data: { isActive: false } });
    expect(await auth.findStaffBySessionToken(third.token)).toBeNull();

    expect(await auth.findStaffBySessionToken("not-a-real-token")).toBeNull();
  });

  it("login options list only id and name of active staff", async () => {
    const waiter = await makeStaff("WAITER", "2580");
    const hidden = await makeStaff("WAITER", "2580");
    await db.staff.update({ where: { id: hidden.id }, data: { isActive: false } });

    const options = await auth.listLoginOptions();
    expect(options.find((o) => o.id === waiter.id)).toEqual({ id: waiter.id, name: waiter.name });
    expect(options.find((o) => o.id === hidden.id)).toBeUndefined();
  });

  describe("change own PIN", () => {
    it("needs the current PIN, refuses weak or unchanged PINs", async () => {
      const waiter = await makeStaff("WAITER", "2580");
      const { token, staff } = await auth.login({ staffId: waiter.id, pin: "2580" });

      await failsWith(auth.changeOwnPin(staff, token, { currentPin: "9999", newPin: "4829" }), "INVALID_CREDENTIALS");
      await failsWith(auth.changeOwnPin(staff, token, { currentPin: "2580", newPin: "1234" }), "WEAK_PIN");
      await failsWith(auth.changeOwnPin(staff, token, { currentPin: "2580", newPin: "2580" }), "SAME_PIN");
      await failsWith(auth.changeOwnPin(staff, token, { currentPin: "2580", newPin: "482901" }), "INVALID_INPUT");
    });

    it("works, signs out the other devices, and keeps this one", async () => {
      const waiter = await makeStaff("WAITER", "2580");
      const here = await auth.login({ staffId: waiter.id, pin: "2580" });
      const elsewhere = await auth.login({ staffId: waiter.id, pin: "2580" });

      await auth.changeOwnPin(here.staff, here.token, { currentPin: "2580", newPin: "4829" });

      expect(await auth.findStaffBySessionToken(here.token)).not.toBeNull();
      expect(await auth.findStaffBySessionToken(elsewhere.token)).toBeNull();
      await failsWith(auth.login({ staffId: waiter.id, pin: "2580" }), "INVALID_CREDENTIALS");
      await auth.login({ staffId: waiter.id, pin: "4829" });
    });
  });

  describe("manager approval", () => {
    it("a Manager's PIN approves, and it is written to the audit log", async () => {
      const waiter = await makeStaff("WAITER", "2580");
      const manager = await makeStaff("MANAGER", "483920");
      const actor = { id: waiter.id, name: waiter.name, role: "WAITER" as const };

      const approver = await auth.verifyManagerApproval(actor, {
        managerId: manager.id,
        pin: "483920",
        reason: "void",
        entityType: "OrderItem",
        entityId: "item-1",
      });
      expect(approver.id).toBe(manager.id);

      const audit = await db.auditLog.findFirstOrThrow({ where: { actorId: waiter.id, action: "approval.granted" } });
      expect(audit.details).toMatchObject({ approvedBy: manager.id, for: "void" });
    });

    it("a Waiter cannot approve, even with the correct PIN (and it does not reveal that the PIN was right)", async () => {
      const waiter = await makeStaff("WAITER", "2580");
      const other = await makeStaff("WAITER", "4829");
      const actor = { id: waiter.id, name: waiter.name, role: "WAITER" as const };
      await failsWith(
        auth.verifyManagerApproval(actor, { managerId: other.id, pin: "4829", reason: "void" }),
        "INVALID_CREDENTIALS",
      );
    });

    it("wrong manager PINs lock the manager account like a login would", async () => {
      const waiter = await makeStaff("WAITER", "2580");
      const manager = await makeStaff("MANAGER", "483920");
      const actor = { id: waiter.id, name: waiter.name, role: "WAITER" as const };
      for (let i = 1; i <= 4; i++) {
        await failsWith(auth.verifyManagerApproval(actor, { managerId: manager.id, pin: "999999", reason: "void" }), "INVALID_CREDENTIALS");
      }
      await failsWith(auth.verifyManagerApproval(actor, { managerId: manager.id, pin: "999999", reason: "void" }), "ACCOUNT_LOCKED");
      await failsWith(auth.verifyManagerApproval(actor, { managerId: manager.id, pin: "483920", reason: "void" }), "ACCOUNT_LOCKED");
    });
  });

  it("the audit log cannot be edited or deleted (database trigger)", async () => {
    const row = await db.auditLog.create({ data: { action: "test.append_only" } });
    await expect(db.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: row.id } })).action).toBe("test.append_only");
  });
});
