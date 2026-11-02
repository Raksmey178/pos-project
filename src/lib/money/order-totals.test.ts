import { describe, expect, it } from "vitest";
import { MoneyError } from "./errors";
import { calculateLineTotalCents, calculateOrderTotals } from "./order-totals";

describe("calculateLineTotalCents", () => {
  it("adds options to the unit price, then multiplies by quantity", () => {
    expect(
      calculateLineTotalCents({ unitPriceCents: 350, modifierDeltasCents: [50, 25], quantity: 2 }),
    ).toBe(850);
  });

  it("works without options", () => {
    expect(calculateLineTotalCents({ unitPriceCents: 425, quantity: 3 })).toBe(1275);
  });

  it("allows a price-reducing option, but never below 0", () => {
    expect(calculateLineTotalCents({ unitPriceCents: 300, modifierDeltasCents: [-50], quantity: 1 })).toBe(250);
    expect(() =>
      calculateLineTotalCents({ unitPriceCents: 100, modifierDeltasCents: [-150], quantity: 1 }),
    ).toThrow(MoneyError);
  });

  it("rejects bad quantity or price", () => {
    expect(() => calculateLineTotalCents({ unitPriceCents: 100, quantity: 0 })).toThrow(MoneyError);
    expect(() => calculateLineTotalCents({ unitPriceCents: 100, quantity: 1.5 })).toThrow(MoneyError);
    expect(() => calculateLineTotalCents({ unitPriceCents: 10.5, quantity: 1 })).toThrow(MoneyError);
  });
});

describe("calculateOrderTotals", () => {
  it("VAT only", () => {
    expect(
      calculateOrderTotals({
        lines: [{ unitPriceCents: 1000, quantity: 1 }],
        serviceChargeBps: 0,
        vatBps: 1000,
      }),
    ).toEqual({ subtotalCents: 1000, discountCents: 0, serviceChargeCents: 0, vatCents: 100, totalCents: 1100 });
  });

  it("discount first, then service charge, then VAT on both", () => {
    // 2 x $10.00 = 2000; 10% off = 200 -> 1800; service 10% = 180; VAT 10% of 1980 = 198
    expect(
      calculateOrderTotals({
        lines: [{ unitPriceCents: 1000, quantity: 2 }],
        discount: { type: "PERCENT", bps: 1000 },
        serviceChargeBps: 1000,
        vatBps: 1000,
      }),
    ).toEqual({ subtotalCents: 2000, discountCents: 200, serviceChargeCents: 180, vatCents: 198, totalCents: 2178 });
  });

  it("rounds VAT once on the whole order, halves up", () => {
    expect(
      calculateOrderTotals({
        lines: [{ unitPriceCents: 1005, quantity: 1 }],
        serviceChargeBps: 0,
        vatBps: 1000,
      }),
    ).toMatchObject({ vatCents: 101, totalCents: 1106 });
  });

  it("several lines with options, service charge and VAT rounding", () => {
    // lines: (350+50) x 2 = 800 and 425 -> subtotal 1225
    // service 5% = 61.25 -> 61; VAT 10% of 1286 = 128.6 -> 129; total 1415
    expect(
      calculateOrderTotals({
        lines: [
          { unitPriceCents: 350, modifierDeltasCents: [50], quantity: 2 },
          { unitPriceCents: 425, quantity: 1 },
        ],
        serviceChargeBps: 500,
        vatBps: 1000,
      }),
    ).toEqual({ subtotalCents: 1225, discountCents: 0, serviceChargeCents: 61, vatCents: 129, totalCents: 1415 });
  });

  it("same order with a 15% discount", () => {
    // discount 183.75 -> 184; 1041 left; service 52.05 -> 52; VAT 10% of 1093 = 109.3 -> 109; total 1202
    expect(
      calculateOrderTotals({
        lines: [
          { unitPriceCents: 350, modifierDeltasCents: [50], quantity: 2 },
          { unitPriceCents: 425, quantity: 1 },
        ],
        discount: { type: "PERCENT", bps: 1500 },
        serviceChargeBps: 500,
        vatBps: 1000,
      }),
    ).toEqual({ subtotalCents: 1225, discountCents: 184, serviceChargeCents: 52, vatCents: 109, totalCents: 1202 });
  });

  it("a fixed discount bigger than the bill leaves a total of 0", () => {
    expect(
      calculateOrderTotals({
        lines: [{ unitPriceCents: 500, quantity: 1 }],
        discount: { type: "FIXED", amountCents: 800 },
        serviceChargeBps: 1000,
        vatBps: 1000,
      }),
    ).toEqual({ subtotalCents: 500, discountCents: 500, serviceChargeCents: 0, vatCents: 0, totalCents: 0 });
  });

  it("an empty order is all zeros", () => {
    expect(calculateOrderTotals({ lines: [], serviceChargeBps: 1000, vatBps: 1000 })).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      serviceChargeCents: 0,
      vatCents: 0,
      totalCents: 0,
    });
  });

  it("the parts always add up to the total", () => {
    for (let price = 1; price <= 2000; price += 37) {
      const t = calculateOrderTotals({
        lines: [{ unitPriceCents: price, quantity: 3 }],
        discount: { type: "PERCENT", bps: 750 },
        serviceChargeBps: 500,
        vatBps: 1000,
      });
      expect(t.subtotalCents - t.discountCents + t.serviceChargeCents + t.vatCents).toBe(t.totalCents);
    }
  });

  it("rejects bad rates", () => {
    expect(() => calculateOrderTotals({ lines: [], serviceChargeBps: -1, vatBps: 0 })).toThrow(MoneyError);
    expect(() => calculateOrderTotals({ lines: [], serviceChargeBps: 0, vatBps: 10_001 })).toThrow(MoneyError);
  });
});
