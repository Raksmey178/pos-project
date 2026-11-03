import { assertInt, assertNonNegativeInt } from "./validate";

function withThousands(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 735 -> "$7.35", 123456 -> "$1,234.56", -50 -> "-$0.50". For showing prices only. */
export function formatUsd(cents: number): string {
  assertInt(cents, "cents");
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${withThousands(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}

/** A price change: 50 -> "+$0.50", -50 -> "-$0.50", 0 -> "$0.00". */
export function formatUsdDelta(cents: number): string {
  assertInt(cents, "cents");
  return cents > 0 ? `+${formatUsd(cents)}` : formatUsd(cents);
}

/** 30100 -> "30,100 ៛" */
export function formatRiel(riel: number): string {
  assertNonNegativeInt(riel, "riel");
  return `${withThousands(riel)} ៛`;
}
