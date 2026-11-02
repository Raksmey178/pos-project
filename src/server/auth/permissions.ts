import type { Role } from "@/lib/roles";

// The ONE place that says what each role may do. New phases add their permissions here.
export const PERMISSIONS = ["staff:view", "staff:manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  WAITER: [],
  CASHIER: [],
  KITCHEN: [],
  MANAGER: ["staff:view", "staff:manage"],
  ADMIN: ["staff:view", "staff:manage"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
