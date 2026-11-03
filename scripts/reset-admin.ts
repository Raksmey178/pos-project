// Run:  npm run staff:reset-admin
// Use it when the Admin forgot the PIN, is locked out, or PIN_SECRET was changed.
// It sets the PIN of the Admin named INITIAL_ADMIN_NAME (in .env) to INITIAL_ADMIN_PIN,
// unlocks the account, switches it on and signs it out everywhere. It is recorded in the audit log.
// Only someone who can edit .env and reach the database on the server can run it.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkPin } from "../src/lib/pin-policy";
import { hashPin } from "../src/server/auth/pin";

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const pin = process.env.INITIAL_ADMIN_PIN;

  if (!databaseUrl) fail("DATABASE_URL is missing in .env");
  if (!name || !pin) fail("Set INITIAL_ADMIN_NAME (the Admin's name) and INITIAL_ADMIN_PIN (the new PIN) in .env first.");

  const problem = checkPin("ADMIN", pin);
  if (problem === "LENGTH" || problem === "FORMAT") fail("An Admin PIN must be exactly 6 digits.");
  if (problem === "WEAK") fail("That PIN is too easy to guess (like 123456 or 111111). Choose another.");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const admin = await db.staff.findUnique({ where: { name } });
    if (!admin || admin.role !== "ADMIN") {
      fail(`There is no Admin named "${name}". Check INITIAL_ADMIN_NAME in .env (or run: npm run staff:create-admin).`);
    }

    const pinHash = await hashPin(pin);
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: admin.id },
        data: { pinHash, failedPinAttempts: 0, lockedUntil: null, isActive: true },
      });
      await tx.session.updateMany({ where: { staffId: admin.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({
        data: {
          action: "staff.pin_reset",
          entityType: "Staff",
          entityId: admin.id,
          details: { source: "reset-admin script" },
        },
      });
    });
    console.log(`PIN of Admin "${name}" has been reset. Log in, change the PIN, then delete INITIAL_ADMIN_PIN from .env.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Could not reset the Admin PIN:", error instanceof Error ? error.message : error);
  process.exit(1);
});
