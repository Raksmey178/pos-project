import { divideRound } from "./rounding";
import { assertNonNegativeInt, assertPositiveInt, assertSafe } from "./validate";

export type Currency = "USD" | "KHR";

/** Cash in KHR is rounded to the nearest 100 riel (the smallest note in use). */
export const KHR_CASH_STEP = 100;

// The exchange rate is "riel per 1 US dollar" as a whole number, e.g. 4100.
// USD is always in cents (100 cents = $1); KHR is always whole riel.

/** Exact conversion, rounded to the nearest riel. */
export function usdCentsToRiel(cents: number, khrPerUsd: number): number {
  assertNonNegativeInt(cents, "cents");
  assertPositiveInt(khrPerUsd, "khrPerUsd");
  assertSafe(cents * khrPerUsd, "cents x rate");
  return divideRound(cents * khrPerUsd, 100);
}

/** Riel to US cents, rounded to the nearest cent. */
export function rielToUsdCents(riel: number, khrPerUsd: number): number {
  assertNonNegativeInt(riel, "riel");
  assertPositiveInt(khrPerUsd, "khrPerUsd");
  assertSafe(riel * 100, "riel x 100");
  return divideRound(riel * 100, khrPerUsd);
}

/** Round riel to the nearest `step` (default 100), halves up. */
export function roundRiel(riel: number, step: number = KHR_CASH_STEP): number {
  assertNonNegativeInt(riel, "riel");
  assertPositiveInt(step, "step");
  return divideRound(riel, step) * step;
}

/** What a customer actually pays in KHR cash for an amount in USD cents. */
export function usdCentsToCashRiel(cents: number, khrPerUsd: number): number {
  return roundRiel(usdCentsToRiel(cents, khrPerUsd));
}
