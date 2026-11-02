// The only entry point for money math. Import from "@/lib/money", never from
// the individual files, and never do money arithmetic anywhere else in the app.
export { MoneyError } from "./errors";
export { divideRound, mulBps } from "./rounding";
export { allocate, splitEqually, splitProportionally, validateCustomSplit } from "./allocate";
export { calculateDiscountCents, discountNeedsApproval, type Discount } from "./discount";
export {
  calculateLineTotalCents,
  calculateOrderTotals,
  type OrderLineInput,
  type OrderTotals,
  type OrderTotalsInput,
} from "./order-totals";
export {
  KHR_CASH_STEP,
  rielToUsdCents,
  roundRiel,
  usdCentsToCashRiel,
  usdCentsToRiel,
  type Currency,
} from "./currency";
export { calculateCashPayment, type CashPaymentInput, type CashPaymentResult, type Money } from "./cash-payment";
