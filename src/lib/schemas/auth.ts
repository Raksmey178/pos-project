import { z } from "zod";

// 4 to 6 digits; the exact length for the role is checked on the server.
export const pinSchema = z.string().regex(/^\d{4,6}$/);

export const loginSchema = z.strictObject({
  staffId: z.uuid(),
  pin: pinSchema,
});

export const changeOwnPinSchema = z.strictObject({
  currentPin: pinSchema,
  newPin: pinSchema,
});
