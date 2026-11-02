// Every error the API can send. The screens turn each code into Khmer text
// (src/messages/km.json, section "Errors"), so the API never sends display text.
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "NOT_FOUND",
  "CONFLICT",
  "WEAK_PIN",
  "SAME_PIN",
  "NETWORK", // used by screens when the request itself fails
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
