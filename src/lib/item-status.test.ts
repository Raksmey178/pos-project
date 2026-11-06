import { describe, expect, it } from "vitest";
import {
  isForward,
  isSingleStep,
  ITEM_STATUSES,
  minutesWaiting,
  nextStatus,
  permissionForStep,
  previousStatus,
  waitLevel,
} from "./item-status";

describe("steps", () => {
  it("only single steps are allowed, forward or back", () => {
    expect(isSingleStep("NEW", "PREPARING")).toBe(true);
    expect(isSingleStep("PREPARING", "READY")).toBe(true);
    expect(isSingleStep("READY", "SERVED")).toBe(true);
    expect(isSingleStep("READY", "PREPARING")).toBe(true); // undo
    expect(isSingleStep("SERVED", "READY")).toBe(true); // undo
  });

  it("jumps and no-change are not steps", () => {
    expect(isSingleStep("NEW", "READY")).toBe(false);
    expect(isSingleStep("NEW", "SERVED")).toBe(false);
    expect(isSingleStep("SERVED", "NEW")).toBe(false);
    expect(isSingleStep("READY", "READY")).toBe(false);
  });

  it("knows forward from back", () => {
    expect(isForward("NEW", "PREPARING")).toBe(true);
    expect(isForward("PREPARING", "NEW")).toBe(false);
    expect(isForward("NEW", "READY")).toBe(false);
  });

  it("next and previous", () => {
    expect(ITEM_STATUSES.map(nextStatus)).toEqual(["PREPARING", "READY", "SERVED", null]);
    expect(ITEM_STATUSES.map(previousStatus)).toEqual([null, "NEW", "PREPARING", "READY"]);
  });
});

describe("who may make a step", () => {
  it("the kitchen prepares, the floor serves", () => {
    expect(permissionForStep("NEW", "PREPARING")).toBe("kitchen:prepare");
    expect(permissionForStep("PREPARING", "READY")).toBe("kitchen:prepare");
    expect(permissionForStep("READY", "PREPARING")).toBe("kitchen:prepare");
    expect(permissionForStep("READY", "SERVED")).toBe("kitchen:serve");
    expect(permissionForStep("SERVED", "READY")).toBe("kitchen:serve");
  });
});

describe("waiting time", () => {
  const sent = "2026-11-05T10:00:00.000Z";
  it("counts whole minutes", () => {
    expect(minutesWaiting(sent, new Date("2026-11-05T10:00:59.000Z"))).toBe(0);
    expect(minutesWaiting(sent, new Date("2026-11-05T10:07:30.000Z"))).toBe(7);
  });

  it("never goes negative (clocks differ a little)", () => {
    expect(minutesWaiting(sent, new Date("2026-11-05T09:59:00.000Z"))).toBe(0);
  });

  it("turns amber at 10 minutes and red at 20", () => {
    expect(waitLevel(0)).toBe("ok");
    expect(waitLevel(9)).toBe("ok");
    expect(waitLevel(10)).toBe("slow");
    expect(waitLevel(19)).toBe("slow");
    expect(waitLevel(20)).toBe("late");
  });
});
