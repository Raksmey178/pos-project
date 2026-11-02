import { assertBps, assertNonNegativeInt, assertPositiveInt, assertSafe } from "./validate";

/**
 * numerator / denominator, rounded to the nearest whole number, halves go UP
 * (3.5 -> 4, 2.5 -> 3). Integer math only, so there are no floating point surprises.
 */
export function divideRound(numerator: number, denominator: number): number {
  assertNonNegativeInt(numerator, "numerator");
  assertPositiveInt(denominator, "denominator");
  assertSafe(2 * numerator + denominator, "rounding input");
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** amount x percentage, where the percentage is in basis points (1000 = 10%). */
export function mulBps(amount: number, bps: number): number {
  assertNonNegativeInt(amount, "amount");
  assertBps(bps, "bps");
  assertSafe(amount * bps, "amount x bps");
  return divideRound(amount * bps, 10_000);
}
