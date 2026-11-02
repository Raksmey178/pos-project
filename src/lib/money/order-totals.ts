import { MoneyError } from "./errors";
import { calculateDiscountCents, type Discount } from "./discount";
import { mulBps } from "./rounding";
import { assertBps, assertInt, assertNonNegativeInt, assertPositiveInt, assertSafe } from "./validate";

export type OrderLineInput = {
  unitPriceCents: number;
  /** Price change of each chosen option (extra shot +50, no sugar 0, ...). */
  modifierDeltasCents?: readonly number[];
  quantity: number;
};

export type OrderTotalsInput = {
  lines: readonly OrderLineInput[];
  discount?: Discount;
  serviceChargeBps: number; // 500 = 5%
  vatBps: number; // 1000 = 10%
};

export type OrderTotals = {
  subtotalCents: number;
  discountCents: number;
  serviceChargeCents: number;
  vatCents: number;
  totalCents: number;
};

export function calculateLineTotalCents(line: OrderLineInput): number {
  assertNonNegativeInt(line.unitPriceCents, "unitPriceCents");
  assertPositiveInt(line.quantity, "quantity");

  const deltas = line.modifierDeltasCents ?? [];
  deltas.forEach((delta, i) => assertInt(delta, `modifierDeltasCents[${i}]`));
  const unitCents = line.unitPriceCents + deltas.reduce((sum, delta) => sum + delta, 0);
  if (unitCents < 0) throw new MoneyError("an item with its options cannot cost less than 0");

  assertSafe(unitCents * line.quantity, "line total");
  return unitCents * line.quantity;
}

/**
 * The one place that decides how a bill is added up. The order of steps:
 *   1. subtotal        = sum of the lines
 *   2. discount        = taken off the subtotal
 *   3. service charge  = % of (subtotal - discount)
 *   4. VAT             = % of (subtotal - discount + service charge), added on top
 *   5. total           = (subtotal - discount) + service charge + VAT
 * Each percentage is rounded once, to the nearest cent (halves up), on the whole
 * order, never per line. Tips are NOT part of this: they are added at payment
 * time and are not taxed.
 *
 * NOTE: ask your accountant to confirm this order matches how your VAT invoice
 * must be calculated. If it differs, it is changed here and nowhere else.
 */
export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  assertBps(input.serviceChargeBps, "serviceChargeBps");
  assertBps(input.vatBps, "vatBps");

  const subtotalCents = input.lines.reduce((sum, line) => sum + calculateLineTotalCents(line), 0);
  assertSafe(subtotalCents, "subtotal");

  const discountCents = calculateDiscountCents(subtotalCents, input.discount);
  const afterDiscountCents = subtotalCents - discountCents;
  const serviceChargeCents = mulBps(afterDiscountCents, input.serviceChargeBps);
  const vatCents = mulBps(afterDiscountCents + serviceChargeCents, input.vatBps);
  const totalCents = afterDiscountCents + serviceChargeCents + vatCents;

  return { subtotalCents, discountCents, serviceChargeCents, vatCents, totalCents };
}
