import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  createMenuItemSchema,
  createModifierGroupSchema,
  createModifierOptionSchema,
  setSoldOutSchema,
  updateMenuItemSchema,
} from "./menu";

const id = "6b1f8e5e-2a3c-4d2b-9a77-0d6c4c1f9a10";
const validItem = { categoryId: id, stationId: id, nameKm: "កាហ្វេ", priceCents: 350 };

describe("menu item schema", () => {
  it("accepts a normal item", () => {
    expect(createMenuItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("price must be whole cents within range", () => {
    expect(createMenuItemSchema.safeParse({ ...validItem, priceCents: 3.5 }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ ...validItem, priceCents: -1 }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ ...validItem, priceCents: 1_000_001 }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ ...validItem, priceCents: 0 }).success).toBe(true);
  });

  it("rejects empty names, bad ids and unknown fields", () => {
    expect(createMenuItemSchema.safeParse({ ...validItem, nameKm: "   " }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ ...validItem, categoryId: "nope" }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ ...validItem, isSoldOut: true }).success).toBe(false);
  });

  it("an empty English name becomes null", () => {
    const parsed = createMenuItemSchema.parse({ ...validItem, nameEn: "  " });
    expect(parsed.nameEn).toBeNull();
  });

  it("update needs at least one field and still rejects unknown ones", () => {
    expect(updateMenuItemSchema.safeParse({}).success).toBe(false);
    expect(updateMenuItemSchema.safeParse({ priceCents: 400 }).success).toBe(true);
    expect(updateMenuItemSchema.safeParse({ priceCents: 400, isSoldOut: true }).success).toBe(false);
  });
});

describe("modifier group schema", () => {
  it("min must not be bigger than max, and max is at least 1", () => {
    const base = { nameKm: "ទំហំ" };
    expect(createModifierGroupSchema.safeParse({ ...base, minSelect: 1, maxSelect: 1 }).success).toBe(true);
    expect(createModifierGroupSchema.safeParse({ ...base, minSelect: 0, maxSelect: 3 }).success).toBe(true);
    expect(createModifierGroupSchema.safeParse({ ...base, minSelect: 2, maxSelect: 1 }).success).toBe(false);
    expect(createModifierGroupSchema.safeParse({ ...base, minSelect: 0, maxSelect: 0 }).success).toBe(false);
  });
});

describe("other menu schemas", () => {
  it("option price change can be negative", () => {
    expect(createModifierOptionSchema.safeParse({ nameKm: "តូច", priceDeltaCents: -50 }).success).toBe(true);
    expect(createModifierOptionSchema.safeParse({ nameKm: "តូច", priceDeltaCents: 0.5 }).success).toBe(false);
  });

  it("category and sold-out schemas", () => {
    expect(createCategorySchema.safeParse({ nameKm: "ភេសជ្ជៈ" }).success).toBe(true);
    expect(createCategorySchema.safeParse({}).success).toBe(false);
    expect(setSoldOutSchema.safeParse({ isSoldOut: true }).success).toBe(true);
    expect(setSoldOutSchema.safeParse({ isSoldOut: "yes" }).success).toBe(false);
  });
});
