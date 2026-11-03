import { describe, expect, it } from "vitest";
import { MoneyError } from "./errors";
import { formatRiel, formatUsd, formatUsdDelta } from "./format";

describe("formatUsd", () => {
  it("shows dollars and cents", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(5)).toBe("$0.05");
    expect(formatUsd(350)).toBe("$3.50");
    expect(formatUsd(735)).toBe("$7.35");
    expect(formatUsd(100_000)).toBe("$1,000.00");
    expect(formatUsd(123_456)).toBe("$1,234.56");
    expect(formatUsd(100_000_000)).toBe("$1,000,000.00");
  });

  it("shows negative amounts", () => {
    expect(formatUsd(-50)).toBe("-$0.50");
    expect(formatUsd(-12_345)).toBe("-$123.45");
  });

  it("rejects decimals", () => {
    expect(() => formatUsd(3.5)).toThrow(MoneyError);
    expect(() => formatUsd(Number.NaN)).toThrow(MoneyError);
  });
});

describe("formatUsdDelta", () => {
  it("shows the sign of a price change", () => {
    expect(formatUsdDelta(50)).toBe("+$0.50");
    expect(formatUsdDelta(-50)).toBe("-$0.50");
    expect(formatUsdDelta(0)).toBe("$0.00");
  });
});

describe("formatRiel", () => {
  it("groups thousands and adds the riel sign", () => {
    expect(formatRiel(0)).toBe("0 ៛");
    expect(formatRiel(900)).toBe("900 ៛");
    expect(formatRiel(30_100)).toBe("30,100 ៛");
    expect(formatRiel(1_234_500)).toBe("1,234,500 ៛");
  });

  it("rejects negatives and decimals", () => {
    expect(() => formatRiel(-1)).toThrow(MoneyError);
    expect(() => formatRiel(10.5)).toThrow(MoneyError);
  });
});
