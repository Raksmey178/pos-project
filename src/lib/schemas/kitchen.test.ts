import { describe, expect, it } from "vitest";
import { itemStatusChangeSchema, sendToKitchenSchema } from "./orders";

const id = "6b1f8e5e-2a3c-4d2b-9a77-0d6c4c1f9a10";

describe("kitchen schemas", () => {
  it("send needs a client id", () => {
    expect(sendToKitchenSchema.safeParse({ clientSendId: id }).success).toBe(true);
    expect(sendToKitchenSchema.safeParse({}).success).toBe(false);
    expect(sendToKitchenSchema.safeParse({ clientSendId: id, orderId: id }).success).toBe(false);
  });

  it("a status change needs ids, the old and the new status", () => {
    expect(itemStatusChangeSchema.safeParse({ itemIds: [id], from: "NEW", to: "PREPARING" }).success).toBe(true);
    expect(itemStatusChangeSchema.safeParse({ itemIds: [], from: "NEW", to: "PREPARING" }).success).toBe(false);
    expect(itemStatusChangeSchema.safeParse({ itemIds: [id], from: "NEW" }).success).toBe(false);
    expect(itemStatusChangeSchema.safeParse({ itemIds: [id], from: "NEW", to: "DONE" }).success).toBe(false);
    expect(itemStatusChangeSchema.safeParse({ itemIds: Array(61).fill(id), from: "NEW", to: "PREPARING" }).success).toBe(false);
  });
});
