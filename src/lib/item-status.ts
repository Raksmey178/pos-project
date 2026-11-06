// The life of an ordered item in the kitchen: NEW -> PREPARING -> READY -> SERVED.
// (An item that has not been sent yet has no ticket and is only a draft on the waiter's screen.)
// Plain logic with no database, shared by the screens and the server.

export const ITEM_STATUSES = ["NEW", "PREPARING", "READY", "SERVED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

const ORDER: Record<ItemStatus, number> = { NEW: 0, PREPARING: 1, READY: 2, SERVED: 3 };

/** One step forward (start, ready, served) or one step back (undo a mistake). Never jumps. */
export function isSingleStep(from: ItemStatus, to: ItemStatus): boolean {
  return Math.abs(ORDER[to] - ORDER[from]) === 1;
}

export function isForward(from: ItemStatus, to: ItemStatus): boolean {
  return ORDER[to] - ORDER[from] === 1;
}

export type StepPermission = "kitchen:prepare" | "kitchen:serve";

/**
 * Who may make the step: the kitchen prepares (NEW <-> PREPARING <-> READY),
 * the floor staff serve (READY <-> SERVED).
 */
export function permissionForStep(from: ItemStatus, to: ItemStatus): StepPermission {
  return from === "SERVED" || to === "SERVED" ? "kitchen:serve" : "kitchen:prepare";
}

/** The status after a step forward, or null when there is none. */
export function nextStatus(status: ItemStatus): ItemStatus | null {
  return ITEM_STATUSES[ORDER[status] + 1] ?? null;
}

export function previousStatus(status: ItemStatus): ItemStatus | null {
  return ITEM_STATUSES[ORDER[status] - 1] ?? null;
}

export type WaitLevel = "ok" | "slow" | "late";
export const SLOW_AFTER_MINUTES = 10;
export const LATE_AFTER_MINUTES = 20;

/** Whole minutes between sending and now (never negative). */
export function minutesWaiting(sentAtIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(sentAtIso).getTime()) / 60_000));
}

/** Tickets turn amber after 10 minutes and red after 20. */
export function waitLevel(minutes: number): WaitLevel {
  if (minutes >= LATE_AFTER_MINUTES) return "late";
  if (minutes >= SLOW_AFTER_MINUTES) return "slow";
  return "ok";
}
