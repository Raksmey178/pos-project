export const ROLES = ["WAITER", "CASHIER", "KITCHEN", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Managers and Admins can approve voids, refunds and big discounts with their PIN. */
export function isApproverRole(role: Role): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

/** Waiter, Cashier, Kitchen: 4 digits (fast at the counter). Manager, Admin: 6 digits. */
export function requiredPinLength(role: Role): 4 | 6 {
  return isApproverRole(role) ? 6 : 4;
}

/**
 * Who may create, change, unlock or deactivate whom.
 * Admin: everyone. Manager: only Waiter, Cashier and Kitchen (so a manager can never
 * create or take over an Admin). Everyone else: nobody.
 * The server enforces this; the screens use it only to hide buttons.
 */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "ADMIN") return true;
  if (actorRole === "MANAGER") return !isApproverRole(targetRole);
  return false;
}
