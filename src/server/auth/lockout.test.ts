import { describe, expect, it } from "vitest";
import { isLocked, LOCKOUT_MINUTES, lockUntil, MAX_FAILED_ATTEMPTS, shouldLock } from "./lockout";

const now = new Date("2026-11-02T10:00:00.000Z");

describe("lockout rules", () => {
  it("locks on the 5th wrong PIN, not before", () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
    expect(shouldLock(4)).toBe(false);
    expect(shouldLock(5)).toBe(true);
  });

  it("locks for 15 minutes", () => {
    expect(LOCKOUT_MINUTES).toBe(15);
    expect(lockUntil(now).toISOString()).toBe("2026-11-02T10:15:00.000Z");
  });

  it("isLocked is true only until the lock time", () => {
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(undefined, now)).toBe(false);
    expect(isLocked(new Date("2026-11-02T10:00:01.000Z"), now)).toBe(true);
    expect(isLocked(new Date("2026-11-02T10:00:00.000Z"), now)).toBe(false); // exactly now = over
    expect(isLocked(new Date("2026-11-02T09:59:00.000Z"), now)).toBe(false);
  });
});
