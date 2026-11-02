import { describe, expect, it } from "vitest";
import { calculateDiscountCents, discountNeedsApproval } from "./discount";
import { MoneyError } from "./errors";

describe("calculateDiscountCents", () => {
  it("no discount means 0", () => {
    expect(calculateDiscountCents(1000)).toBe(0);
  });

  it("percent discount, rounded to the nearest cent (halves up)", () => {
    expect(calculateDiscountCents(1000, { type: "PERCENT", bps: 1000 })).toBe(100);
    expect(calculateDiscountCents(1225, { type: "PERCENT", bps: 1500 })).toBe(184); // 183.75
    expect(calculateDiscountCents(1005, { type: "PERCENT", bps: 1000 })).toBe(101); // 100.5
  });

  it("fixed discount, never more than the subtotal", () => {
    expect(calculateDiscountCents(1000, { type: "FIXED", amountCents: 250 })).toBe(250);
    expect(calculateDiscountCents(500, { type: "FIXED", amountCents: 800 })).toBe(500);
  });

  it("rejects invalid discounts", () => {
    expect(() => calculateDiscountCents(1000, { type: "PERCENT", bps: 10_001 })).toThrow(MoneyError);
    expect(() => calculateDiscountCents(1000, { type: "FIXED", amountCents: -5 })).toThrow(MoneyError);
    expect(() => calculateDiscountCents(1000, { type: "FIXED", amountCents: 2.5 })).toThrow(MoneyError);
  });
});

describe("discountNeedsApproval (manager PIN above the threshold)", () => {
  const threshold = 1000; // 10%

  it("percent: exactly at the threshold is allowed, above needs a manager", () => {
    expect(discountNeedsApproval(1000, { type: "PERCENT", bps: 1000 }, threshold)).toBe(false);
    expect(discountNeedsApproval(1000, { type: "PERCENT", bps: 1001 }, threshold)).toBe(true);
    expect(discountNeedsApproval(1000, { type: "PERCENT", bps: 500 }, threshold)).toBe(false);
  });

  it("an exact 10% is not pushed over the line by cent rounding", () => {
    // 10% of $10.05 = 101 cents after rounding, but the discount is still 10%.
    expect(discountNeedsApproval(1005, { type: "PERCENT", bps: 1000 }, threshold)).toBe(false);
  });

  it("fixed amount: compared as a share of the subtotal", () => {
    expect(discountNeedsApproval(1000, { type: "FIXED", amountCents: 100 }, threshold)).toBe(false);
    expect(discountNeedsApproval(1000, { type: "FIXED", amountCents: 101 }, threshold)).toBe(true);
  });

  it("fixed amount bigger than the bill counts as 100%", () => {
    expect(discountNeedsApproval(500, { type: "FIXED", amountCents: 800 }, threshold)).toBe(true);
  });

  it("empty bill needs no approval", () => {
    expect(discountNeedsApproval(0, { type: "FIXED", amountCents: 100 }, threshold)).toBe(false);
  });
});
