import "server-only";
import { checkPin as checkPinPolicy } from "@/lib/pin-policy";
import { isApproverRole, type Role } from "@/lib/roles";
import { db } from "@/server/db";
import { hashPin, verifyDummyPin, verifyPin } from "@/server/auth/pin";
import { isLocked, lockUntil, shouldLock } from "@/server/auth/lockout";
import { generateSessionToken, hashSessionToken, sessionExpiry } from "@/server/auth/session-token";
import { ApiError } from "@/server/errors";
import { writeAudit } from "./audit";

export type AuthedStaff = { id: string; name: string; role: Role };

/** Names shown on the login screen. Only id and name: no roles, nothing else. */
export function listLoginOptions() {
  return db.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Checks one person's PIN. Used by login, "change my PIN" and manager approval, so
 * the lockout rules are identical everywhere:
 *   - 5 wrong PINs in a row lock the account for 15 minutes
 *   - while locked, even the right PIN is refused (and not even checked)
 *   - unknown, inactive or not-allowed accounts look exactly like a wrong PIN
 */
async function verifyStaffPin(
  staffId: string,
  pin: string,
  failedAction: string,
  allowedRoles?: (role: Role) => boolean,
): Promise<AuthedStaff> {
  const now = new Date();
  const staff = await db.staff.findUnique({ where: { id: staffId } });

  if (!staff || !staff.isActive || (allowedRoles && !allowedRoles(staff.role))) {
    await verifyDummyPin(pin);
    throw new ApiError(401, "INVALID_CREDENTIALS");
  }

  if (isLocked(staff.lockedUntil, now)) {
    throw new ApiError(429, "ACCOUNT_LOCKED", { lockedUntil: staff.lockedUntil!.toISOString() });
  }

  if (!(await verifyPin(staff.pinHash, pin))) {
    const lockedUntil = await recordFailedAttempt(staff.id, now, failedAction);
    if (lockedUntil) throw new ApiError(429, "ACCOUNT_LOCKED", { lockedUntil: lockedUntil.toISOString() });
    throw new ApiError(401, "INVALID_CREDENTIALS");
  }

  if (staff.failedPinAttempts > 0 || staff.lockedUntil) {
    await db.staff.update({ where: { id: staff.id }, data: { failedPinAttempts: 0, lockedUntil: null } });
  }
  return { id: staff.id, name: staff.name, role: staff.role };
}

/** Counts a wrong PIN (atomically) and locks the account on the 5th. Returns the lock end, if locked. */
async function recordFailedAttempt(staffId: string, now: Date, action: string): Promise<Date | null> {
  return db.$transaction(async (tx) => {
    const { failedPinAttempts } = await tx.staff.update({
      where: { id: staffId },
      data: { failedPinAttempts: { increment: 1 } },
      select: { failedPinAttempts: true },
    });
    await writeAudit(tx, { action, entityType: "Staff", entityId: staffId });

    if (!shouldLock(failedPinAttempts)) return null;

    const until = lockUntil(now);
    await tx.staff.update({ where: { id: staffId }, data: { failedPinAttempts: 0, lockedUntil: until } });
    await writeAudit(tx, {
      action: "auth.account_locked",
      entityType: "Staff",
      entityId: staffId,
      details: { until: until.toISOString() },
    });
    return until;
  });
}

export async function login(input: { staffId: string; pin: string }) {
  const staff = await verifyStaffPin(input.staffId, input.pin, "auth.login_failed");

  const now = new Date();
  const token = generateSessionToken();
  const expiresAt = sessionExpiry(now);

  await db.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { expiresAt: { lt: now } } }); // housekeeping
    await tx.session.create({ data: { tokenHash: hashSessionToken(token), staffId: staff.id, expiresAt } });
    await writeAudit(tx, { actorId: staff.id, action: "auth.login", entityType: "Staff", entityId: staff.id });
  });

  return { token, expiresAt, staff };
}

/** Finds who a session cookie belongs to. null = not logged in (unknown, expired, ended, or account switched off). */
export async function findStaffBySessionToken(token: string, now = new Date()): Promise<AuthedStaff | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      staff: { select: { id: true, name: true, role: true, isActive: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= now || !session.staff.isActive) return null;
  const { id, name, role } = session.staff;
  return { id, name, role };
}

export async function logout(token: string, actor: AuthedStaff | null): Promise<void> {
  const ended = await db.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (actor && ended.count > 0) {
    await writeAudit(db, { actorId: actor.id, action: "auth.logout", entityType: "Staff", entityId: actor.id });
  }
}

export async function changeOwnPin(
  actor: AuthedStaff,
  currentToken: string,
  input: { currentPin: string; newPin: string },
): Promise<void> {
  await verifyStaffPin(actor.id, input.currentPin, "auth.pin_change_failed");

  const problem = checkPinPolicy(actor.role, input.newPin);
  if (problem === "WEAK") throw new ApiError(400, "WEAK_PIN");
  if (problem) throw new ApiError(400, "INVALID_INPUT");
  if (input.newPin === input.currentPin) throw new ApiError(400, "SAME_PIN");

  const pinHash = await hashPin(input.newPin);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.staff.update({ where: { id: actor.id }, data: { pinHash } });
    // Sign out every other device; keep the one used right now.
    await tx.session.updateMany({
      where: { staffId: actor.id, revokedAt: null, tokenHash: { not: hashSessionToken(currentToken) } },
      data: { revokedAt: now },
    });
    await writeAudit(tx, { actorId: actor.id, action: "auth.pin_changed", entityType: "Staff", entityId: actor.id });
  });
}

/**
 * Manager approval, for voids, refunds and discounts above the limit.
 * The manager picks their own name and types their PIN on the waiter's screen.
 * Only active Managers and Admins can approve; the same lockout rules apply.
 * Returns who approved, and records the approval in the audit log.
 */
export async function verifyManagerApproval(
  actor: AuthedStaff,
  input: { managerId: string; pin: string; reason: string; entityType?: string; entityId?: string },
): Promise<AuthedStaff> {
  const manager = await verifyStaffPin(input.managerId, input.pin, "auth.approval_failed", isApproverRole);
  await writeAudit(db, {
    actorId: actor.id,
    action: "approval.granted",
    entityType: input.entityType,
    entityId: input.entityId,
    details: { approvedBy: manager.id, for: input.reason },
  });
  return manager;
}
