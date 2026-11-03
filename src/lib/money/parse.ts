/**
 * Turns what a person typed ("3.5", "3.50", "12") into whole US cents (350, 350, 1200).
 * Works on the text itself, never through decimals, so there are no rounding surprises.
 * Returns null when the text is not a valid amount (e.g. "3.555", "abc", "$3", ".5").
 * Negative amounts ("-0.50") are accepted only with { allowNegative: true } (price reductions).
 */
export function parseUsdToCents(input: string, options: { allowNegative?: boolean } = {}): number | null {
  const match = /^([+-]?)(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;

  const [, sign, whole, fraction = ""] = match;
  if (sign !== "" && !options.allowNegative) return null;

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents || 0 : cents; // "-0" must not become -0
}
