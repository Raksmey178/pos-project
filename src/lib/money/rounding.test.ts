import { describe, expect, it } from "vitest";
import { MoneyError } from "./errors";
import { divideRound, mulBps } from "./rounding";

describe("divideRound (halves round up)", () => {
  it("rounds to the nearest whole number", () => {
    expect(divideRound(1, 3)).toBe(0); // 0.33
    expect(divideRound(2, 3)).toBe(1); // 0.67
    expect(divideRound(10, 4)).toBe(3); // 2.5 -> 3
  });

  it("rounds exact halves up", () => {
    expect(divideRound(7, 2)).toBe(4); // 3.5
    expect(divideRound(5, 2)).toBe(3); // 2.5
  });

  it("keeps exact results exact", () => {
    expect(divideRound(100, 4)).toBe(25);
    expect(divideRound(0, 7)).toBe(0);
  });

  it("rejects a zero denominator and non-integers", () => {
    expect(() => divideRound(1, 0)).toThrow(MoneyError);
    expect(() => divideRound(1.5, 2)).toThrow(MoneyError);
    expect(() => divideRound(-1, 2)).toThrow(MoneyError);
  });
});

describe("mulBps (percentage in basis points)", () => {
  it("calculates 10% of $10.00", () => {
    expect(mulBps(1000, 1000)).toBe(100);
  });

  it("rounds halves up: 10% of $10.05 = 100.5 cents -> 101", () => {
    expect(mulBps(1005, 1000)).toBe(101);
  });

  it("rounds down below the half: 10% of $10.04 = 100.4 cents -> 100", () => {
    expect(mulBps(1004, 1000)).toBe(100);
  });

  it("handles 0% and 100%", () => {
    expect(mulBps(1234, 0)).toBe(0);
    expect(mulBps(1234, 10_000)).toBe(1234);
    expect(mulBps(0, 1000)).toBe(0);
  });

  it("rejects out-of-range or non-integer percentages and amounts", () => {
    expect(() => mulBps(1000, 10_001)).toThrow(MoneyError);
    expect(() => mulBps(1000, -1)).toThrow(MoneyError);
    expect(() => mulBps(10.5, 1000)).toThrow(MoneyError);
    expect(() => mulBps(Number.NaN, 1000)).toThrow(MoneyError);
  });
});
