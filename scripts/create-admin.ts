// Run once:  npm run staff:create-admin
// Creates the first Admin from INITIAL_ADMIN_NAME and INITIAL_ADMIN_PIN in .env.
// Does nothing if an Admin already exists.
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
  if (!name || !pin) fail("Set INITIAL_ADMIN_NAME and INITIAL_ADMIN_PIN in .env first.");

  const problem = checkPin("ADMIN", pin);
  if (problem === "LENGTH" || problem === "FORMAT") fail("An Admin PIN must be exactly 6 digits.");
  if (problem === "WEAK") fail("That PIN is too easy to guess (like 123456 or 111111). Choose another.");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    if ((await db.staff.count({ where: { role: "ADMIN" } })) > 0) {
      console.log("An Admin already exists. Nothing to do.");
      return;
    }

    const pinHash = await hashPin(pin);
    await db.$transaction(async (tx) => {
      const admin = await tx.staff.create({ data: { name, role: "ADMIN", pinHash } });
      await tx.auditLog.create({
        data: {
          action: "staff.create",
          entityType: "Staff",
          entityId: admin.id,
          details: { role: "ADMIN", source: "create-admin script" },
        },
      });
    });
    console.log(`Admin "${name}" created. Log in, change the PIN, then delete INITIAL_ADMIN_PIN from .env.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Could not create the Admin:", error instanceof Error ? error.message : error);
  process.exit(1);
});
