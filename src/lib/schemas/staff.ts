import { z } from "zod";
import { ROLES } from "../roles";
import { pinSchema } from "./auth";

// strictObject: unknown fields are rejected, so nobody can sneak in extra data.
const nameSchema = z.string().trim().min(1).max(60);

export const createStaffSchema = z.strictObject({
  name: nameSchema,
  role: z.enum(ROLES),
  pin: pinSchema,
});

export const updateStaffSchema = z
  .strictObject({
    name: nameSchema.optional(),
    isActive: z.boolean().optional(),
    role: z.enum(ROLES).optional(),
    // Needed only when the new role requires a different PIN length.
    pin: pinSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const resetPinSchema = z.strictObject({ pin: pinSchema });
