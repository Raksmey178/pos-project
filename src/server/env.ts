import "server-only";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/business-date";

// Every environment variable the app needs is listed and checked here.
// If one is missing the app stops at startup with a clear message,
// instead of failing later in a confusing place.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is missing (see .env.example)"),
  PIN_SECRET: z.string().min(32, "PIN_SECRET must be at least 32 characters (see .env.example)"),
  // Order numbers restart at local midnight in this time zone.
  RESTAURANT_TIMEZONE: z
    .string()
    .default("Asia/Phnom_Penh")
    .refine(isValidTimeZone, "RESTAURANT_TIMEZONE must be a real time zone name, like Asia/Phnom_Penh"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
