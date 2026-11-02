import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "pos_session";
export const SESSION_HOURS = 12;

/** 256 random bits. Impossible to guess. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash goes into the database, never the token itself. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_HOURS * 60 * 60_000);
}
