import { describe, expect, it } from "vitest";
import { canManageRole, isApproverRole, requiredPinLength, ROLES, type Role } from "./roles";

describe("PIN length by role", () => {
  it("is 4 digits for floor staff and 6 for Manager and Admin", () => {
    expect(requiredPinLength("WAITER")).toBe(4);
    expect(requiredPinLength("CASHIER")).toBe(4);
    expect(requiredPinLength("KITCHEN")).toBe(4);
    expect(requiredPinLength("MANAGER")).toBe(6);
    expect(requiredPinLength("ADMIN")).toBe(6);
  });
});

describe("approver roles", () => {
  it("only Manager and Admin can approve", () => {
    expect(ROLES.filter(isApproverRole)).toEqual(["MANAGER", "ADMIN"]);
  });
});

describe("canManageRole", () => {
  it("Admin manages everyone", () => {
    for (const target of ROLES) expect(canManageRole("ADMIN", target)).toBe(true);
  });

  it("Manager manages only Waiter, Cashier and Kitchen", () => {
    expect(canManageRole("MANAGER", "WAITER")).toBe(true);
    expect(canManageRole("MANAGER", "CASHIER")).toBe(true);
    expect(canManageRole("MANAGER", "KITCHEN")).toBe(true);
    expect(canManageRole("MANAGER", "MANAGER")).toBe(false);
    expect(canManageRole("MANAGER", "ADMIN")).toBe(false);
  });

  it("floor staff manage nobody", () => {
    const floor: Role[] = ["WAITER", "CASHIER", "KITCHEN"];
    for (const actor of floor) for (const target of ROLES) expect(canManageRole(actor, target)).toBe(false);
  });
});
