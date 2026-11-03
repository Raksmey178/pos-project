import "server-only";
import type { z } from "zod";
import { checkPin } from "@/lib/pin-policy";
import { canManageRole, requiredPinLength, type Role } from "@/lib/roles";
import type { createStaffSchema, updateStaffSchema } from "@/lib/schemas/staff";
import { db } from "@/server/db";
import { isLocked } from "@/server/auth/lockout";
import { hashPin } from "@/server/auth/pin";
import { isUniqueViolation } from "@/server/db-errors";
import { ApiError } from "@/server/errors";
import type { AuthedStaff } from "./auth";
import { writeAudit } from "./audit";

// Never select pinHash here: it must not leave the server.
const STAFF_SELECT = { id: true, name: true, role: true, isActive: true, lockedUntil: true, createdAt: true } as const;

export type StaffRow = {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
  /** true while the account is locked after too many wrong PINs */
  isLocked: boolean;
  createdAt: string;
};

type StaffRecord = { id: string; name: string; role: Role; isActive: boolean; lockedUntil: Date | null; createdAt: Date };

function toRow(staff: StaffRecord): StaffRow {
  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    isActive: staff.isActive,
    isLocked: isLocked(staff.lockedUntil, new Date()),
    createdAt: staff.createdAt.toISOString(),
  };
}

function assertCanManage(actor: AuthedStaff, targetRole: Role): void {
  if (!canManageRole(actor.role, targetRole)) throw new ApiError(403, "FORBIDDEN");
}

function assertPinAllowed(role: Role, pin: string): void {
  const problem = checkPin(role, pin);
  if (problem === "WEAK") throw new ApiError(400, "WEAK_PIN");
  if (problem) throw new ApiError(400, "INVALID_INPUT");
}

async function findTarget(id: string): Promise<StaffRecord> {
  const target = await db.staff.findUnique({ where: { id }, select: STAFF_SELECT });
  if (!target) throw new ApiError(404, "NOT_FOUND");
  return target;
}

export async function listStaff(): Promise<StaffRow[]> {
  const rows = await db.staff.findMany({ select: STAFF_SELECT, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return rows.map(toRow);
}

export async function createStaff(actor: AuthedStaff, input: z.infer<typeof createStaffSchema>): Promise<StaffRow> {
  assertCanManage(actor, input.role);
  assertPinAllowed(input.role, input.pin);
  const pinHash = await hashPin(input.pin);

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: { name: input.name, role: input.role, pinHash },
        select: STAFF_SELECT,
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "staff.create",
        entityType: "Staff",
        entityId: created.id,
        details: { role: input.role },
      });
      return toRow(created);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
    throw error;
  }
}

export async function updateStaff(
  actor: AuthedStaff,
  id: string,
  patch: z.infer<typeof updateStaffSchema>,
): Promise<StaffRow> {
  const target = await findTarget(id);
  assertCanManage(actor, target.role);

  const newRole = patch.role ?? target.role;
  const roleChanged = newRole !== target.role;
  const deactivating = patch.isActive === false && target.isActive;
  const activating = patch.isActive === true && !target.isActive;
  const renaming = patch.name !== undefined && patch.name !== target.name;

  if (roleChanged) assertCanManage(actor, newRole);
  // Nobody can demote or switch off themselves (this also means the last Admin can never be removed).
  if (actor.id === id && (roleChanged || deactivating)) throw new ApiError(403, "FORBIDDEN");

  // A PIN may be sent only together with a role change, and is required when the new role needs a different length.
  if (patch.pin !== undefined && !roleChanged) throw new ApiError(400, "INVALID_INPUT");
  const needsNewPin = roleChanged && requiredPinLength(newRole) !== requiredPinLength(target.role);
  if (needsNewPin && patch.pin === undefined) throw new ApiError(400, "INVALID_INPUT");
  if (patch.pin !== undefined) assertPinAllowed(newRole, patch.pin);
  const pinHash = patch.pin !== undefined ? await hashPin(patch.pin) : undefined;

  const now = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          name: patch.name,
          isActive: patch.isActive,
          role: patch.role,
          ...(pinHash ? { pinHash, failedPinAttempts: 0, lockedUntil: null } : {}),
        },
        select: STAFF_SELECT,
      });

      const audit = (action: string, details?: Record<string, string | boolean>) =>
        writeAudit(tx, { actorId: actor.id, action, entityType: "Staff", entityId: id, details });

      if (renaming) await audit("staff.renamed", { from: target.name, to: patch.name as string });
      if (roleChanged) await audit("staff.role_changed", { from: target.role, to: newRole, pinChanged: pinHash !== undefined });
      if (deactivating) await audit("staff.deactivated");
      if (activating) await audit("staff.activated");

      // New permissions or a switched-off account must not keep working through an old login.
      if (roleChanged || deactivating) {
        await tx.session.updateMany({ where: { staffId: id, revokedAt: null }, data: { revokedAt: now } });
      }
      return toRow(updated);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
    throw error;
  }
}

/** A manager sets a new PIN for someone who forgot theirs. (People change their own PIN with changeOwnPin.) */
export async function resetStaffPin(actor: AuthedStaff, id: string, pin: string): Promise<void> {
  const target = await findTarget(id);
  if (actor.id === id) throw new ApiError(403, "FORBIDDEN");
  assertCanManage(actor, target.role);
  assertPinAllowed(target.role, pin);
  const pinHash = await hashPin(pin);

  await db.$transaction(async (tx) => {
    await tx.staff.update({ where: { id }, data: { pinHash, failedPinAttempts: 0, lockedUntil: null } });
    await tx.session.updateMany({ where: { staffId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: actor.id, action: "staff.pin_reset", entityType: "Staff", entityId: id });
  });
}

export async function unlockStaff(actor: AuthedStaff, id: string): Promise<void> {
  const target = await findTarget(id);
  assertCanManage(actor, target.role);

  await db.$transaction(async (tx) => {
    await tx.staff.update({ where: { id }, data: { failedPinAttempts: 0, lockedUntil: null } });
    await writeAudit(tx, { actorId: actor.id, action: "staff.unlocked", entityType: "Staff", entityId: id });
  });
}

/** Signs the person out everywhere (lost tablet, forgotten logout). Returns how many logins were ended. */
export async function revokeStaffSessions(actor: AuthedStaff, id: string): Promise<number> {
  const target = await findTarget(id);
  assertCanManage(actor, target.role);

  return db.$transaction(async (tx) => {
    const { count } = await tx.session.updateMany({
      where: { staffId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "staff.sessions_revoked",
      entityType: "Staff",
      entityId: id,
      details: { count },
    });
    return count;
  });
}
