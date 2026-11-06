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
  "orders:view", // open an order and see what is on it
  "orders:edit", // open orders, add and remove items, request the bill, transfer and merge tables
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
   WAITER: ["menu:view", "tables:view", "orders:view", "orders:edit"],
  CASHIER: ["menu:view", "tables:view", "orders:view", "orders:edit"],
  KITCHEN: ["menu:view", "menu:soldout", "tables:view"], // the kitchen knows first when something runs out
  MANAGER: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage", "orders:view", "orders:edit"],
  ADMIN: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage", "orders:view", "orders:edit"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
