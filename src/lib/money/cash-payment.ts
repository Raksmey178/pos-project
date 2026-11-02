import { MoneyError } from "./errors";
import { rielToUsdCents, roundRiel, usdCentsToCashRiel, usdCentsToRiel, type Currency } from "./currency";
import { assertPositiveInt } from "./validate";

/** USD amounts are in cents, KHR amounts are in whole riel. */
export type Money = { currency: Currency; amount: number };

export type CashPaymentInput = {
  /** What is still unpaid on the bill, in USD cents. */
  dueCents: number;
  /** What the customer handed over. */
  tendered: Money;
  /** Riel per 1 USD, whole number (e.g. 4100). */
  khrPerUsd: number;
  /** Currency to give change in. Default: the same currency the customer paid in. */
  changeCurrency?: Currency;
};

export type CashPaymentResult = {
  /** How much of the bill this payment settles, in USD cents. */
  appliedCents: number;
  change: Money;
  /** Bill still unpaid afterwards, in USD cents (0 = fully paid). */
  remainingCents: number;
};

/**
 * Cash payment in USD or KHR (or several in a row, for mixed payments).
 *
 * - Paying in KHR: the bill is first turned into riel and rounded to the nearest
 *   100 riel, because that is what can actually be handed over.
 * - If the remaining bill rounds to 0 riel (a cent or so), it counts as paid.
 * - Part payments in KHR are converted back to cents (rounded to the nearest cent);
 *   a mixed USD + KHR payment can therefore differ from a single-currency one by
 *   up to one rounding step (100 riel).
 */
export function calculateCashPayment(input: CashPaymentInput): CashPaymentResult {
  const { dueCents, tendered, khrPerUsd } = input;
  assertPositiveInt(dueCents, "dueCents");
  assertPositiveInt(tendered.amount, "tendered.amount");
  assertPositiveInt(khrPerUsd, "khrPerUsd");
  if (tendered.currency !== "USD" && tendered.currency !== "KHR") {
    throw new MoneyError(`unsupported currency: ${String(tendered.currency)}`);
  }
  const changeCurrency = input.changeCurrency ?? tendered.currency;

  if (tendered.currency === "USD") {
    const appliedCents = Math.min(tendered.amount, dueCents);
    const changeCents = tendered.amount - appliedCents;
    const change: Money =
      changeCurrency === "USD"
        ? { currency: "USD", amount: changeCents }
        : { currency: "KHR", amount: roundRiel(usdCentsToRiel(changeCents, khrPerUsd)) };
    return { appliedCents, change, remainingCents: dueCents - appliedCents };
  }

  // Customer pays in KHR
  const dueRiel = usdCentsToCashRiel(dueCents, khrPerUsd);

  if (tendered.amount >= dueRiel) {
    const changeRiel = tendered.amount - dueRiel;
    const change: Money =
      changeCurrency === "KHR"
        ? { currency: "KHR", amount: changeRiel }
        : { currency: "USD", amount: rielToUsdCents(changeRiel, khrPerUsd) };
    return { appliedCents: dueCents, change, remainingCents: 0 };
  }

  // Part payment: less than the whole bill
  const appliedCents = Math.min(rielToUsdCents(tendered.amount, khrPerUsd), dueCents);
  return {
    appliedCents,
    change: { currency: changeCurrency, amount: 0 },
    remainingCents: dueCents - appliedCents,
  };
}
