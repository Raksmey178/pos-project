import { describe, expect, it } from "vitest";
import { calculateCashPayment } from "./cash-payment";
import { MoneyError } from "./errors";

const RATE = 4100; // riel per 1 USD
const DUE = 735; // $7.35 (30,135 riel exactly, 30,100 riel as cash)

describe("paying in USD", () => {
  it("exact amount", () => {
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 735 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 735,
      change: { currency: "USD", amount: 0 },
      remainingCents: 0,
    });
  });

  it("more than the bill gives change in USD", () => {
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 1000 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 735,
      change: { currency: "USD", amount: 265 },
      remainingCents: 0,
    });
  });

  it("change can be given in KHR, rounded to the nearest 100 riel", () => {
    // 265 cents = 10,865 riel -> 10,900
    expect(
      calculateCashPayment({
        dueCents: DUE,
        tendered: { currency: "USD", amount: 1000 },
        khrPerUsd: RATE,
        changeCurrency: "KHR",
      }),
    ).toEqual({ appliedCents: 735, change: { currency: "KHR", amount: 10_900 }, remainingCents: 0 });
  });

  it("less than the bill is a part payment", () => {
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 500 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 500,
      change: { currency: "USD", amount: 0 },
      remainingCents: 235,
    });
  });
});

describe("paying in KHR", () => {
  it("exact cash amount (bill rounded to 100 riel)", () => {
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "KHR", amount: 30_100 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 735,
      change: { currency: "KHR", amount: 0 },
      remainingCents: 0,
    });
  });

  it("more than the bill gives change in KHR", () => {
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "KHR", amount: 50_000 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 735,
      change: { currency: "KHR", amount: 19_900 },
      remainingCents: 0,
    });
  });

  it("change can be given in USD instead", () => {
    // 19,900 riel = 485.37 cents -> 485
    expect(
      calculateCashPayment({
        dueCents: DUE,
        tendered: { currency: "KHR", amount: 50_000 },
        khrPerUsd: RATE,
        changeCurrency: "USD",
      }),
    ).toEqual({ appliedCents: 735, change: { currency: "USD", amount: 485 }, remainingCents: 0 });
  });

  it("less than the bill is a part payment", () => {
    // 20,000 riel = 488 cents (487.8), leaving 247
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "KHR", amount: 20_000 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 488,
      change: { currency: "KHR", amount: 0 },
      remainingCents: 247,
    });
  });

  it("100 riel short of the cash amount is still a part payment", () => {
    // 30,000 riel = 731.7 -> 732 cents, 3 cents (about 123 riel) remain
    expect(calculateCashPayment({ dueCents: DUE, tendered: { currency: "KHR", amount: 30_000 }, khrPerUsd: RATE })).toMatchObject({
      appliedCents: 732,
      remainingCents: 3,
    });
  });

  it("a remaining bill that rounds to 0 riel counts as paid", () => {
    expect(calculateCashPayment({ dueCents: 1, tendered: { currency: "KHR", amount: 100 }, khrPerUsd: RATE })).toEqual({
      appliedCents: 1,
      change: { currency: "KHR", amount: 100 },
      remainingCents: 0,
    });
  });
});

describe("mixed currencies on one bill", () => {
  it("$5.00 in USD, then the rest in KHR", () => {
    const first = calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 500 }, khrPerUsd: RATE });
    expect(first.remainingCents).toBe(235);

    // 235 cents = 9,635 riel -> 9,600 cash; customer hands over 10,000
    const second = calculateCashPayment({
      dueCents: first.remainingCents,
      tendered: { currency: "KHR", amount: 10_000 },
      khrPerUsd: RATE,
    });
    expect(second).toEqual({ appliedCents: 235, change: { currency: "KHR", amount: 400 }, remainingCents: 0 });
    expect(first.appliedCents + second.appliedCents).toBe(DUE);
  });
});

describe("bad input", () => {
  it("rejects empty or invalid payments", () => {
    expect(() => calculateCashPayment({ dueCents: 0, tendered: { currency: "USD", amount: 100 }, khrPerUsd: RATE })).toThrow(MoneyError);
    expect(() => calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 0 }, khrPerUsd: RATE })).toThrow(MoneyError);
    expect(() => calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 10.5 }, khrPerUsd: RATE })).toThrow(MoneyError);
    expect(() => calculateCashPayment({ dueCents: DUE, tendered: { currency: "USD", amount: 100 }, khrPerUsd: 0 })).toThrow(MoneyError);
    expect(() =>
      calculateCashPayment({ dueCents: DUE, tendered: { currency: "EUR" as never, amount: 100 }, khrPerUsd: RATE }),
    ).toThrow(MoneyError);
  });
});
