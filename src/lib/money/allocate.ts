import { MoneyError } from "./errors";
import { assertNonNegativeInt, assertPositiveInt, assertSafe } from "./validate";

/**
 * Splits `total` into parts proportional to `weights`, with NO money lost or
 * invented: the parts always add up to exactly `total`.
 *
 * Method ("largest remainder"): give everyone their rounded-down share, then hand
 * the leftover units out one by one to whoever lost the most to rounding.
 * Ties go to the earlier position, so the result is always the same.
 *
 * Example: allocate(100, [1, 1, 1]) -> [34, 33, 33]
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  assertNonNegativeInt(total, "total");
  if (weights.length === 0) throw new MoneyError("weights must not be empty");
  weights.forEach((weight, i) => assertNonNegativeInt(weight, `weights[${i}]`));

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0) throw new MoneyError("at least one weight must be greater than 0");
  assertSafe(total * Math.max(...weights), "total x weight");

  const shares = weights.map((weight, index) => {
    const exact = total * weight;
    return {
      index,
      amount: Math.floor(exact / weightSum),
      remainder: exact % weightSum,
    };
  });

  const allocated = shares.reduce((sum, share) => sum + share.amount, 0);
  const leftover = total - allocated; // always smaller than the number of parts

  const byBiggestRemainder = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  for (let i = 0; i < leftover; i++) byBiggestRemainder[i].amount += 1;

  return shares.map((share) => share.amount);
}

/** Split a bill equally. The first guests pay the extra cent(s). */
export function splitEqually(total: number, parts: number): number[] {
  assertPositiveInt(parts, "parts");
  return allocate(total, Array<number>(parts).fill(1));
}

/**
 * Split a bill by what each person ordered. Pass each person's item subtotal;
 * discount, service charge and VAT are shared in the same proportion.
 */
export function splitProportionally(total: number, subtotals: readonly number[]): number[] {
  return allocate(total, subtotals);
}

/** For "custom amounts" splits: checks the amounts add up to the bill exactly. */
export function validateCustomSplit(total: number, amounts: readonly number[]): number[] {
  assertNonNegativeInt(total, "total");
  amounts.forEach((amount, i) => assertNonNegativeInt(amount, `amounts[${i}]`));
  const sum = amounts.reduce((acc, amount) => acc + amount, 0);
  if (sum !== total) {
    throw new MoneyError(`custom split adds up to ${sum}, but the bill is ${total}`);
  }
  return [...amounts];
}
