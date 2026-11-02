export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLocked(lockedUntil: Date | null | undefined, now: Date): boolean {
  return lockedUntil != null && lockedUntil.getTime() > now.getTime();
}

export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function lockUntil(now: Date): Date {
  return new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
}
