import { requiredPinLength, type Role } from "./roles";

export type PinProblem = "FORMAT" | "LENGTH" | "WEAK";

/** 0000, 111111, 1234, 4321, 123456 ... are too easy to guess. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true; // all the same digit
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, i) => digit - digits[i]);
  return steps.every((step) => step === 1) || steps.every((step) => step === -1);
}

/** Returns what is wrong with the PIN for this role, or null when it is fine. */
export function checkPin(role: Role, pin: string): PinProblem | null {
  if (!/^\d+$/.test(pin)) return "FORMAT";
  if (pin.length !== requiredPinLength(role)) return "LENGTH";
  if (isWeakPin(pin)) return "WEAK";
  return null;
}
