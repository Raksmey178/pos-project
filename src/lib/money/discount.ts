import { MoneyError } from "./errors";
import { mulBps } from "./rounding";
import { assertBps, assertNonNegativeInt } from "./validate";

export type Discount =
  | { type: "PERCENT"; bps: number } // 1000 = 10%
  | { type: "FIXED"; amountCents: number };

/** Discount in USD cents. A fixed discount can never be bigger than the subtotal. */
export function calculateDiscountCents(subtotalCents: number, discount?: Discount): number {
  assertNonNegativeInt(subtotalCents, "subtotalCents");
  if (!discount) return 0;

  switch (discount.type) {
    case "PERCENT":
      assertBps(discount.bps, "discount.bps");
      return mulBps(subtotalCents, discount.bps);
    case "FIXED":
      assertNonNegativeInt(discount.amountCents, "discount.amountCents");
      return Math.min(discount.amountCents, subtotalCents);
    default:
      throw new MoneyError("unknown discount type");
  }
}

/**
 * Rule: a manager PIN is needed when the discount is ABOVE the threshold
 * (exactly at the threshold is allowed without a manager).
 * Fixed amounts are compared with whole-number math (no decimals).
 */
export function discountNeedsApproval(
  subtotalCents: number,
  discount: Discount,
  thresholdBps: number,
): boolean {
  assertNonNegativeInt(subtotalCents, "subtotalCents");
  assertBps(thresholdBps, "thresholdBps");

  if (discount.type === "PERCENT") {
    assertBps(discount.bps, "discount.bps");
    // Compare the percentage itself: rounding the cents first could push an
    // exact 10% over the line (10% of $10.05 rounds to 101 cents).
    return discount.bps > thresholdBps;
  }

  assertNonNegativeInt(discount.amountCents, "discount.amountCents");
  const applied = Math.min(discount.amountCents, subtotalCents);
  return applied * 10_000 > thresholdBps * subtotalCents;
}
