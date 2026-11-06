import { describe, expect, it } from "vitest";
import { addOrderItemSchema, createOrderSchema, mergeOrdersSchema, transferTableSchema } from "./orders";

const id = "6b1f8e5e-2a3c-4d2b-9a77-0d6c4c1f9a10";
const id2 = "0b9f3b8a-6d52-4a4c-8d57-2f4f1c9e7b11";

describe("createOrderSchema", () => {
  it("dine-in needs at least one table", () => {
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN", tableIds: [id2] }).success).toBe(true);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN", tableIds: [] }).success).toBe(false);
  });

  it("takeaway has no tables, and customer details are optional", () => {
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "TAKEAWAY" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "TAKEAWAY", customerName: "Sokha" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "TAKEAWAY", tableIds: [id2] }).success).toBe(false);
  });

  it("delivery needs name, phone and address", () => {
    const base = { clientOrderId: id, type: "DELIVERY" as const };
    expect(createOrderSchema.safeParse({ ...base, customerName: "A", customerPhone: "012 345 678", deliveryAddress: "Street 1" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, customerName: "A", customerPhone: "012 345 678" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, customerName: "A", customerPhone: "abc", deliveryAddress: "x" }).success).toBe(false);
  });

  it("needs a client id and rejects unknown fields (like a status)", () => {
    expect(createOrderSchema.safeParse({ type: "TAKEAWAY" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ clientOrderId: "nope", type: "TAKEAWAY" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "TAKEAWAY", status: "PAID" }).success).toBe(false);
  });

  it("limits guests and tables", () => {
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN", tableIds: [id2], guestCount: 0 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN", tableIds: [id2], guestCount: 100 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ clientOrderId: id, type: "DINE_IN", tableIds: Array(7).fill(id2) }).success).toBe(false);
  });
});

describe("addOrderItemSchema", () => {
  const item = { clientItemId: id, menuItemId: id2, quantity: 2 };

  it("accepts an item, with options defaulting to none", () => {
    const parsed = addOrderItemSchema.parse(item);
    expect(parsed.optionIds).toEqual([]);
  });

  it("limits the quantity and the note", () => {
    expect(addOrderItemSchema.safeParse({ ...item, quantity: 0 }).success).toBe(false);
    expect(addOrderItemSchema.safeParse({ ...item, quantity: 100 }).success).toBe(false);
    expect(addOrderItemSchema.safeParse({ ...item, quantity: 1.5 }).success).toBe(false);
    expect(addOrderItemSchema.safeParse({ ...item, note: "x".repeat(201) }).success).toBe(false);
  });

  it("an empty note becomes null, and the price cannot be sent", () => {
    expect(addOrderItemSchema.parse({ ...item, note: "  " }).note).toBeNull();
    expect(addOrderItemSchema.safeParse({ ...item, unitPriceCents: 1 }).success).toBe(false);
  });
});

describe("other order schemas", () => {
  it("transfer and merge need real ids", () => {
    expect(transferTableSchema.safeParse({ fromTableId: id, toTableId: id2 }).success).toBe(true);
    expect(transferTableSchema.safeParse({ fromTableId: id }).success).toBe(false);
    expect(mergeOrdersSchema.safeParse({ sourceOrderId: id }).success).toBe(true);
    expect(mergeOrdersSchema.safeParse({ sourceOrderId: "x" }).success).toBe(false);
  });
});
