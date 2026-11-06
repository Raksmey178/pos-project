import { describe, expect, it } from "vitest";
import { businessDateOf, isValidTimeZone } from "./business-date";

describe("businessDateOf", () => {
  it("uses the date in the restaurant's time zone, not UTC", () => {
    // 17:30 UTC on 5 Nov is 00:30 on 6 Nov in Phnom Penh (UTC+7)
    const instant = new Date("2026-11-05T17:30:00Z");
    expect(businessDateOf(instant, "Asia/Phnom_Penh")).toBe("2026-11-06");
    expect(businessDateOf(instant, "UTC")).toBe("2026-11-05");
  });

  it("is stable inside the day", () => {
    expect(businessDateOf(new Date("2026-11-05T00:00:00Z"), "Asia/Phnom_Penh")).toBe("2026-11-05");
    expect(businessDateOf(new Date("2026-11-05T16:59:59Z"), "Asia/Phnom_Penh")).toBe("2026-11-05");
    expect(businessDateOf(new Date("2026-11-05T17:00:00Z"), "Asia/Phnom_Penh")).toBe("2026-11-06");
  });

  it("pads month and day", () => {
    expect(businessDateOf(new Date("2026-01-02T05:00:00Z"), "UTC")).toBe("2026-01-02");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects nonsense", () => {
    expect(isValidTimeZone("Asia/Phnom_Penh")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
