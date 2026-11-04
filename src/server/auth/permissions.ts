import type { Role } from "@/lib/roles";

// The ONE place that says what each role may do. New phases add their permissions here.
export const PERMISSIONS = [
  "staff:view",
  "staff:manage",
  "menu:view", // see the menu while taking orders
  "menu:soldout", // mark an item sold out / available again
  "menu:manage", // create and edit categories, items, modifiers, stations and prices
  "tables:view", // see the floor plan
  "tables:manage", // create and edit zones and tables, and arrange the floor plan
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
   WAITER: ["menu:view", "tables:view"],
  CASHIER: ["menu:view", "tables:view"],
  KITCHEN: ["menu:view", "menu:soldout", "tables:view"], // the kitchen knows first when something runs out
  MANAGER: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage"],
  ADMIN: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage"]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
