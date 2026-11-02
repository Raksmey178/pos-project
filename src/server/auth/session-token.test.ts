import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken, SESSION_HOURS, sessionExpiry } from "./session-token";

describe("session tokens", () => {
  it("are long, random and different every time", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).toHaveLength(43); // 32 random bytes, base64url
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("are stored as a hash, never as the token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash); // same token, same hash
    expect(hashSessionToken(generateSessionToken())).not.toBe(hash);
  });

  it("expire after 12 hours", () => {
    expect(SESSION_HOURS).toBe(12);
    const now = new Date("2026-11-02T10:00:00.000Z");
    expect(sessionExpiry(now).toISOString()).toBe("2026-11-02T22:00:00.000Z");
  });
});
