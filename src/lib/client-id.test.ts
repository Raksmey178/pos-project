import { describe, expect, it } from "vitest";
import { z } from "zod";
import { newClientId } from "./client-id";

describe("newClientId", () => {
  it("makes a valid v4 UUID that the API accepts", () => {
    for (let i = 0; i < 50; i++) {
      const id = newClientId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(z.uuid().safeParse(id).success).toBe(true);
    }
  });

  it("never repeats", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newClientId()));
    expect(ids.size).toBe(1000);
  });
});
