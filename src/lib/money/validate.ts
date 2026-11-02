import { MoneyError } from "./errors";

// All money values are whole numbers (USD cents, KHR riel). Never decimals.

export function assertInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${name} must be a whole number, got ${value}`);
  }
}

export function assertNonNegativeInt(value: number, name: string): void {
  assertInt(value, name);
  if (value < 0) throw new MoneyError(`${name} must not be negative, got ${value}`);
}

export function assertPositiveInt(value: number, name: string): void {
  assertInt(value, name);
  if (value <= 0) throw new MoneyError(`${name} must be greater than 0, got ${value}`);
}

/** Basis points: 1 bp = 0.01%. Valid range 0 to 10000 (0% to 100%). */
export function assertBps(value: number, name: string): void {
  assertNonNegativeInt(value, name);
  if (value > 10_000) throw new MoneyError(`${name} must be at most 10000 (100%), got ${value}`);
}

/** Guards against numbers too big to calculate exactly. */
export function assertSafe(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${what} is too large to calculate exactly`);
  }
}
