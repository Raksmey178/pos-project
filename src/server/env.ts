import "server-only";
import { z } from "zod";

// Every environment variable the app needs is listed and checked here.
// If one is missing the app stops at startup with a clear message,
// instead of failing later in a confusing place.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is missing (see .env.example)"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
