import { describe, expect, it } from "vitest";
import { calculateOrderTotals, splitProportionally } from "./index";

describe("split by items on a real bill", () => {
  it("each guest's share includes their part of VAT, and shares add up to the total", () => {
    // Guest A ordered $10.05, guest B ordered $5.00. VAT 10% on the whole order.
    const totals = calculateOrderTotals({
      lines: [
        { unitPriceCents: 1005, quantity: 1 },
        { unitPriceCents: 500, quantity: 1 },
      ],
      serviceChargeBps: 0,
      vatBps: 1000,
    });
    expect(totals.totalCents).toBe(1656); // 1505 + VAT 151

    const shares = splitProportionally(totals.totalCents, [1005, 500]);
    expect(shares).toEqual([1106, 550]);
    expect(shares[0] + shares[1]).toBe(totals.totalCents);
  });
});
