import { afterEach, describe, expect, it } from "vitest";
import { hashPin, verifyDummyPin, verifyPin } from "./pin";

const originalSecret = process.env.PIN_SECRET;
afterEach(() => {
  process.env.PIN_SECRET = originalSecret;
});

describe("PIN hashing", () => {
  it("never stores the PIN, and verifies the right one", async () => {
    const hash = await hashPin("482913");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("482913");
    expect(await verifyPin(hash, "482913")).toBe(true);
    expect(await verifyPin(hash, "482914")).toBe(false);
  });

  it("gives a different hash each time (random salt)", async () => {
    expect(await hashPin("482913")).not.toBe(await hashPin("482913"));
  });

  it("does not verify with a different secret key", async () => {
    const hash = await hashPin("482913");
    process.env.PIN_SECRET = "a-completely-different-secret-key-0000";
    expect(await verifyPin(hash, "482913")).toBe(false);
  });

  it("refuses to work without a proper secret", async () => {
    process.env.PIN_SECRET = "too-short";
    await expect(hashPin("482913")).rejects.toThrow(/PIN_SECRET/);
    delete process.env.PIN_SECRET;
    await expect(verifyPin("whatever", "482913")).rejects.toThrow(/PIN_SECRET/);
  });

  it("treats a malformed stored hash as a wrong PIN", async () => {
    expect(await verifyPin("not-a-hash", "482913")).toBe(false);
  });

  it("dummy verification runs without error", async () => {
    await expect(verifyDummyPin("1357")).resolves.toBeUndefined();
  });
});
