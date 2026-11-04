import { describe, expect, it } from "vitest";
import { createTableSchema, createZoneSchema, updateTableSchema, updateZoneSchema } from "./tables";

const id = "6b1f8e5e-2a3c-4d2b-9a77-0d6c4c1f9a10";
const table = { zoneId: id, name: "T1", capacity: 4, shape: "RECT" as const, width: 2, height: 2 };

describe("table schemas", () => {
  it("accepts a normal table, with or without a position", () => {
    expect(createTableSchema.safeParse(table).success).toBe(true);
    expect(createTableSchema.safeParse({ ...table, gridX: 3, gridY: 4 }).success).toBe(true);
  });

  it("needs both gridX and gridY, or neither", () => {
    expect(createTableSchema.safeParse({ ...table, gridX: 3 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, gridY: 3 }).success).toBe(false);
  });

  it("limits size, seats and names", () => {
    expect(createTableSchema.safeParse({ ...table, width: 0 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, width: 9 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, capacity: 0 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, capacity: 2.5 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, name: "   " }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, name: "x".repeat(21) }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...table, shape: "TRIANGLE" }).success).toBe(false);
  });

  it("rejects unknown fields (like a status)", () => {
    expect(createTableSchema.safeParse({ ...table, status: "OCCUPIED" }).success).toBe(false);
    expect(updateTableSchema.safeParse({ status: "OCCUPIED" }).success).toBe(false);
  });

  it("update needs at least one field", () => {
    expect(updateTableSchema.safeParse({}).success).toBe(false);
    expect(updateTableSchema.safeParse({ gridX: 1, gridY: 2 }).success).toBe(true);
    expect(updateTableSchema.safeParse({ gridX: -1 }).success).toBe(false);
  });
});

describe("zone schemas", () => {
  it("accepts and rejects", () => {
    expect(createZoneSchema.safeParse({ name: "Indoor" }).success).toBe(true);
    expect(createZoneSchema.safeParse({ name: " " }).success).toBe(false);
    expect(updateZoneSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateZoneSchema.safeParse({}).success).toBe(false);
  });
});
