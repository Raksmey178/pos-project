import { describe, expect, it } from "vitest";
import { MoneyError } from "./errors";
import { rielToUsdCents, roundRiel, usdCentsToCashRiel, usdCentsToRiel } from "./currency";

const RATE = 4100; // riel per 1 USD

describe("usdCentsToRiel", () => {
  it("converts exactly when it can", () => {
    expect(usdCentsToRiel(100, RATE)).toBe(4100);
    expect(usdCentsToRiel(735, RATE)).toBe(30_135);
    expect(usdCentsToRiel(0, RATE)).toBe(0);
  });

  it("rounds to the nearest riel, halves up", () => {
    expect(usdCentsToRiel(1, 4050)).toBe(41); // 40.5
    expect(usdCentsToRiel(1, RATE)).toBe(41);
  });

  it("rejects an invalid rate", () => {
    expect(() => usdCentsToRiel(100, 0)).toThrow(MoneyError);
    expect(() => usdCentsToRiel(100, -4100)).toThrow(MoneyError);
    expect(() => usdCentsToRiel(100, 4100.5)).toThrow(MoneyError);
  });
});

describe("rielToUsdCents", () => {
  it("converts back, rounded to the nearest cent", () => {
    expect(rielToUsdCents(4100, RATE)).toBe(100);
    expect(rielToUsdCents(20_000, RATE)).toBe(488); // 487.8
    expect(rielToUsdCents(0, RATE)).toBe(0);
  });
});

describe("roundRiel (nearest 100)", () => {
  it("rounds to the nearest 100, halves up", () => {
    expect(roundRiel(30_135)).toBe(30_100);
    expect(roundRiel(30_149)).toBe(30_100);
    expect(roundRiel(30_150)).toBe(30_200);
    expect(roundRiel(10_865)).toBe(10_900);
    expect(roundRiel(0)).toBe(0);
  });

  it("supports another step", () => {
    expect(roundRiel(1_240, 500)).toBe(1_000);
    expect(roundRiel(1_250, 500)).toBe(1_500);
  });
});

describe("usdCentsToCashRiel", () => {
  it("is what the customer hands over in KHR cash", () => {
    expect(usdCentsToCashRiel(735, RATE)).toBe(30_100);
    expect(usdCentsToCashRiel(1, RATE)).toBe(0); // 41 riel rounds to 0
  });
});
