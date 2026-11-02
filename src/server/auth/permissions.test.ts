import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "./permissions";

describe("role permissions", () => {
  it("floor staff have no staff-management permissions", () => {
    for (const role of ["WAITER", "CASHIER", "KITCHEN"] as const) {
      for (const permission of PERMISSIONS) expect(hasPermission(role, permission)).toBe(false);
    }
  });

  it("Manager and Admin can view and manage staff", () => {
    for (const role of ["MANAGER", "ADMIN"] as const) {
      expect(hasPermission(role, "staff:view")).toBe(true);
      expect(hasPermission(role, "staff:manage")).toBe(true);
    }
  });
});
