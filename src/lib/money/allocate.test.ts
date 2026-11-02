import { describe, expect, it } from "vitest";
import { allocate, splitEqually, splitProportionally, validateCustomSplit } from "./allocate";
import { MoneyError } from "./errors";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("allocate (largest remainder)", () => {
  it("splits evenly when it can", () => {
    expect(allocate(100, [1, 1])).toEqual([50, 50]);
  });

  it("gives the extra cent to the first person when it cannot", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
  });

  it("follows the weights", () => {
    expect(allocate(1000, [1, 2, 3])).toEqual([167, 333, 500]);
  });

  it("handles zero weights and a zero total", () => {
    expect(allocate(100, [0, 1])).toEqual([0, 100]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });

  it("always adds up to exactly the total (many random cases)", () => {
    // Small deterministic pseudo-random generator, so the test never flakes.
    let seed = 12345;
    const next = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };

    for (let run = 0; run < 500; run++) {
      const total = next(1_000_000);
      const parts = 1 + next(8);
      const weights = Array.from({ length: parts }, () => next(5000));
      if (sum(weights) === 0) continue;

      const result = allocate(total, weights);
      expect(sum(result)).toBe(total);
      expect(result.every((amount) => Number.isInteger(amount) && amount >= 0)).toBe(true);
    }
  });

  it("rejects bad input", () => {
    expect(() => allocate(100, [])).toThrow(MoneyError);
    expect(() => allocate(100, [0, 0])).toThrow(MoneyError);
    expect(() => allocate(100, [1, -1])).toThrow(MoneyError);
    expect(() => allocate(10.5, [1, 1])).toThrow(MoneyError);
    expect(() => allocate(Number.MAX_SAFE_INTEGER, [2, 1])).toThrow(MoneyError);
  });
});

describe("splitEqually", () => {
  it("splits a bill between guests", () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(1001, 2)).toEqual([501, 500]);
    expect(splitEqually(5, 3)).toEqual([2, 2, 1]);
    expect(splitEqually(100, 1)).toEqual([100]);
  });

  it("rejects 0 guests", () => {
    expect(() => splitEqually(100, 0)).toThrow(MoneyError);
  });
});

describe("splitProportionally (split by items)", () => {
  it("shares the bill in proportion to each person's items", () => {
    expect(splitProportionally(1100, [600, 400])).toEqual([660, 440]);
  });

  it("never loses a cent to rounding", () => {
    // 1505 subtotal, bill total 1656 (with VAT): shares must add up to 1656.
    const shares = splitProportionally(1656, [1005, 500]);
    expect(shares).toEqual([1106, 550]);
    expect(sum(shares)).toBe(1656);
  });

  it("can split one shared dish between two people", () => {
    expect(allocate(900, [1, 1])).toEqual([450, 450]);
  });
});

describe("validateCustomSplit", () => {
  it("accepts amounts that add up to the bill", () => {
    expect(validateCustomSplit(1100, [300, 400, 400])).toEqual([300, 400, 400]);
  });

  it("rejects amounts that do not add up", () => {
    expect(() => validateCustomSplit(1100, [300, 400])).toThrow(MoneyError);
    expect(() => validateCustomSplit(1100, [600, 600])).toThrow(MoneyError);
  });
});
