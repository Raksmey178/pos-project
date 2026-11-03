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
});
