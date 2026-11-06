import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("role permissions", () => {
  it("floor staff cannot manage staff", () => {
    for (const role of ["WAITER", "CASHIER", "KITCHEN"] as const) {
      expect(hasPermission(role, "staff:view")).toBe(false);
      expect(hasPermission(role, "staff:manage")).toBe(false);
    }
  });

  it("Manager and Admin can view and manage staff", () => {
    for (const role of ["MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "staff:view")).toBe(true);
      expect(hasPermission(role, "staff:manage")).toBe(true);
    }
  });

  it("everyone can see the menu", () => {
    for (const role of ["WAITER", "CASHIER", "KITCHEN", "MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "menu:view")).toBe(true);
    }
  });

  it("only Kitchen, Manager and Admin can mark items sold out", () => {
    expect(hasPermission("WAITER", "menu:soldout")).toBe(false);
    expect(hasPermission("CASHIER", "menu:soldout")).toBe(false);
    expect(hasPermission("KITCHEN", "menu:soldout")).toBe(true);
    expect(hasPermission("MANAGER", "menu:soldout")).toBe(true);
    expect(hasPermission("ADMIN", "menu:soldout")).toBe(true);
  });

  it("only Manager and Admin can change the menu or its prices", () => {
    for (const role of ["WAITER", "CASHIER", "KITCHEN"] as const) {
      expect(hasPermission(role, "menu:manage")).toBe(false);
    }
    expect(hasPermission("MANAGER", "menu:manage")).toBe(true);
    expect(hasPermission("ADMIN", "menu:manage")).toBe(true);
  });

  it("everyone can see the floor plan, only Manager and Admin can change it", () => {
    for (const role of ["WAITER", "CASHIER", "KITCHEN", "MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "tables:view")).toBe(true);
    }
    for (const role of ["WAITER", "CASHIER", "KITCHEN"] as const) {
      expect(hasPermission(role, "tables:manage")).toBe(false);
    }
    expect(hasPermission("MANAGER", "tables:manage")).toBe(true);
    expect(hasPermission("ADMIN", "tables:manage")).toBe(true);
  });

  it("Waiter, Cashier, Manager and Admin can take orders; the Kitchen cannot", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "orders:view")).toBe(true);
      expect(hasPermission(role, "orders:edit")).toBe(true);
    }
    expect(hasPermission("KITCHEN", "orders:view")).toBe(false);
    expect(hasPermission("KITCHEN", "orders:edit")).toBe(false);
  });

  it("kitchen board: Kitchen prepares, floor staff serve, managers do both", () => {
    expect(hasPermission("KITCHEN", "kitchen:view")).toBe(true);
    expect(hasPermission("KITCHEN", "kitchen:prepare")).toBe(true);
    expect(hasPermission("KITCHEN", "kitchen:serve")).toBe(false);

    expect(hasPermission("WAITER", "kitchen:view")).toBe(true);
    expect(hasPermission("WAITER", "kitchen:serve")).toBe(true);
    expect(hasPermission("WAITER", "kitchen:prepare")).toBe(false);

    expect(hasPermission("CASHIER", "kitchen:view")).toBe(true);
    expect(hasPermission("CASHIER", "kitchen:serve")).toBe(true);
    expect(hasPermission("CASHIER", "kitchen:prepare")).toBe(false);

    for (const role of ["MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "kitchen:view")).toBe(true);
      expect(hasPermission(role, "kitchen:prepare")).toBe(true);
      expect(hasPermission(role, "kitchen:serve")).toBe(true);
    }
  });
});
