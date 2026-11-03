import { describe, expect, it } from "vitest";
import { formatUsd } from "./format";
import { parseUsdToCents } from "./parse";

describe("parseUsdToCents", () => {
  it("reads normal amounts", () => {
    expect(parseUsdToCents("3")).toBe(300);
    expect(parseUsdToCents("3.5")).toBe(350);
    expect(parseUsdToCents("3.50")).toBe(350);
    expect(parseUsdToCents("0.05")).toBe(5);
    expect(parseUsdToCents("0")).toBe(0);
    expect(parseUsdToCents("12.34")).toBe(1234);
    expect(parseUsdToCents(" 7 ")).toBe(700);
    expect(parseUsdToCents("1234.5")).toBe(123_450);
  });

  it("has no floating point surprises", () => {
    // 4.35 * 100 = 434.99999999999994 in floating point; here it must be exact.
    expect(parseUsdToCents("4.35")).toBe(435);
    expect(parseUsdToCents("1.15")).toBe(115);
    expect(parseUsdToCents("0.29")).toBe(29);
  });

  it("rejects anything that is not an amount", () => {
    for (const text of ["", "abc", "3.555", ".5", "3.", "1e3", "3,50", "$3", "1 000", "3.5.0", "1234567"]) {
      expect(parseUsdToCents(text), text).toBeNull();
    }
  });

  it("rejects signs unless negatives are allowed", () => {
    expect(parseUsdToCents("-1")).toBeNull();
    expect(parseUsdToCents("+1")).toBeNull();
  });

  it("accepts price reductions and increases when allowed", () => {
    expect(parseUsdToCents("-0.50", { allowNegative: true })).toBe(-50);
    expect(parseUsdToCents("+0.50", { allowNegative: true })).toBe(50);
    expect(parseUsdToCents("0.50", { allowNegative: true })).toBe(50);
    expect(Object.is(parseUsdToCents("-0", { allowNegative: true }), 0)).toBe(true);
  });

  it("is the exact reverse of formatting (every cent value)", () => {
    for (let cents = 0; cents <= 5000; cents++) {
      const text = formatUsd(cents).replace("$", "").replace(",", "");
      expect(parseUsdToCents(text)).toBe(cents);
    }
  });
});
