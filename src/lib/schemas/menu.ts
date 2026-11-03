import { z } from "zod";

// strictObject: unknown fields are rejected.
// Prices are whole US cents (350 = $3.50). The screens convert what people type with parseUsdToCents.

const nameKm = z.string().trim().min(1).max(80);
// English name is optional; an empty string means "none".
const nameEn = z
  .string()
  .trim()
  .max(80)
  .transform((value) => (value === "" ? null : value))
  .nullable();
const sortOrder = z.number().int().min(0).max(100_000);
const priceCents = z.number().int().min(0).max(1_000_000); // up to $10,000.00
const deltaCents = z.number().int().min(-1_000_000).max(1_000_000);
const selectCount = z.number().int().min(0).max(10);

const notEmpty = (value: object) => Object.keys(value).length > 0;

// ----- stations -----
export const createStationSchema = z.strictObject({ name: nameKm, sortOrder: sortOrder.optional() });
export const updateStationSchema = z
  .strictObject({ name: nameKm, sortOrder, isActive: z.boolean() })
  .partial()
  .refine(notEmpty);

// ----- categories -----
export const createCategorySchema = z.strictObject({
  nameKm,
  nameEn: nameEn.optional(),
  sortOrder: sortOrder.optional(),
});
export const updateCategorySchema = z
  .strictObject({ nameKm, nameEn, sortOrder, isActive: z.boolean() })
  .partial()
  .refine(notEmpty);

// ----- menu items -----
const groupIds = z.array(z.uuid()).max(20);
export const createMenuItemSchema = z.strictObject({
  categoryId: z.uuid(),
  stationId: z.uuid(),
  nameKm,
  nameEn: nameEn.optional(),
  priceCents,
  sortOrder: sortOrder.optional(),
  modifierGroupIds: groupIds.optional(),
});
export const updateMenuItemSchema = z
  .strictObject({
    categoryId: z.uuid(),
    stationId: z.uuid(),
    nameKm,
    nameEn,
    priceCents,
    sortOrder,
    isActive: z.boolean(),
    modifierGroupIds: groupIds,
  })
  .partial()
  .refine(notEmpty);
export const setSoldOutSchema = z.strictObject({ isSoldOut: z.boolean() });

// ----- modifier groups and options -----
export const createModifierGroupSchema = z
  .strictObject({
    nameKm,
    nameEn: nameEn.optional(),
    minSelect: selectCount,
    maxSelect: selectCount.min(1),
    sortOrder: sortOrder.optional(),
  })
  .refine((group) => group.minSelect <= group.maxSelect);
export const updateModifierGroupSchema = z
  .strictObject({
    nameKm,
    nameEn,
    minSelect: selectCount,
    maxSelect: selectCount.min(1),
    sortOrder,
    isActive: z.boolean(),
  })
  .partial()
  .refine(notEmpty);

export const createModifierOptionSchema = z.strictObject({
  nameKm,
  nameEn: nameEn.optional(),
  priceDeltaCents: deltaCents.optional(),
  sortOrder: sortOrder.optional(),
});
export const updateModifierOptionSchema = z
  .strictObject({ nameKm, nameEn, priceDeltaCents: deltaCents, sortOrder, isActive: z.boolean() })
  .partial()
  .refine(notEmpty);
