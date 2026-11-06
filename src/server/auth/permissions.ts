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
  "orders:edit", // open orders, add and remove items, send to the kitchen, request the bill, transfer and merge tables
  "kitchen:view", // see the kitchen board and open kitchen tickets
  "kitchen:prepare", // mark items preparing / ready (and undo)
  "kitchen:serve", // mark ready items as served (and undo)
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  WAITER: ["menu:view", "tables:view", "orders:view", "orders:edit", "kitchen:view", "kitchen:serve"],
  CASHIER: ["menu:view", "tables:view", "orders:view", "orders:edit", "kitchen:view", "kitchen:serve"],
  KITCHEN: ["menu:view", "menu:soldout", "tables:view", "kitchen:view", "kitchen:prepare"], // the kitchen knows first when something runs out
  MANAGER: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage", "orders:view", "orders:edit", "kitchen:view", "kitchen:prepare", "kitchen:serve"],
  ADMIN: ["staff:view", "staff:manage", "menu:view", "menu:soldout", "menu:manage", "tables:view", "tables:manage", "orders:view", "orders:edit", "kitchen:view", "kitchen:prepare", "kitchen:serve"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
