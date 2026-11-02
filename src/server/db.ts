import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// In development Next.js reloads files often. Reusing one client avoids
// opening a new batch of database connections on every reload.
export const db = globalForDb.db ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.db = db;
