import { describe, expect, it } from "vitest";
import { checkPin, isWeakPin } from "./pin-policy";

describe("isWeakPin", () => {
  it("flags repeated digits and straight runs", () => {
    for (const pin of ["0000", "1111", "111111", "1234", "4321", "123456", "654321", "0123"]) {
      expect(isWeakPin(pin), pin).toBe(true);
    }
  });

  it("accepts ordinary PINs", () => {
    for (const pin of ["2580", "1357", "4829", "483920", "102938"]) {
      expect(isWeakPin(pin), pin).toBe(false);
    }
  });
});

describe("checkPin", () => {
  it("accepts a good PIN of the right length", () => {
    expect(checkPin("WAITER", "4829")).toBeNull();
    expect(checkPin("MANAGER", "483920")).toBeNull();
  });

  it("wrong length for the role", () => {
    expect(checkPin("WAITER", "482901")).toBe("LENGTH");
    expect(checkPin("MANAGER", "4829")).toBe("LENGTH");
  });

  it("not digits only", () => {
    expect(checkPin("WAITER", "48a9")).toBe("FORMAT");
    expect(checkPin("WAITER", "")).toBe("FORMAT");
  });

  it("weak PINs", () => {
    expect(checkPin("WAITER", "1234")).toBe("WEAK");
    expect(checkPin("ADMIN", "111111")).toBe("WEAK");
  });
});
