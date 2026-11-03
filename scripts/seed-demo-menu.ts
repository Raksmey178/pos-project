// Run (optional):  npm run menu:seed-demo
// Fills an EMPTY menu with a small demo (2 stations, 3 categories, 8 items, 3 modifier groups)
// so you can see the waiter menu straight away. Does nothing if any category already exists.
// These are sample names only: switch them off or rename them in "Manage menu".
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\nDATABASE_URL is missing in .env\n");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    if ((await db.category.count()) > 0 || (await db.station.count()) > 0) {
      console.log("The menu is not empty. Nothing to do.");
      return;
    }

    await db.$transaction(async (tx) => {
      const kitchen = await tx.station.create({ data: { name: "ផ្ទះបាយ", sortOrder: 10 } });
      const bar = await tx.station.create({ data: { name: "បារ", sortOrder: 20 } });

      const drinks = await tx.category.create({ data: { nameKm: "ភេសជ្ជៈ", nameEn: "Drinks", sortOrder: 10 } });
      const mains = await tx.category.create({ data: { nameKm: "មុខម្ហូបមេ", nameEn: "Main dishes", sortOrder: 20 } });
      const extras = await tx.category.create({ data: { nameKm: "បន្ថែម", nameEn: "Sides", sortOrder: 30 } });

      const size = await tx.modifierGroup.create({
        data: {
          nameKm: "ទំហំ",
          nameEn: "Size",
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 10,
          options: {
            create: [
              { nameKm: "តូច", nameEn: "Small", priceDeltaCents: 0, sortOrder: 10 },
              { nameKm: "មធ្យម", nameEn: "Medium", priceDeltaCents: 50, sortOrder: 20 },
              { nameKm: "ធំ", nameEn: "Large", priceDeltaCents: 100, sortOrder: 30 },
            ],
          },
        },
      });
      const sugar = await tx.modifierGroup.create({
        data: {
          nameKm: "កម្រិតស្ករ",
          nameEn: "Sugar level",
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 20,
          options: {
            create: [
              { nameKm: "គ្មានស្ករ", nameEn: "No sugar", sortOrder: 10 },
              { nameKm: "ស្ករ 50%", nameEn: "50% sugar", sortOrder: 20 },
              { nameKm: "ស្ករ 100%", nameEn: "100% sugar", sortOrder: 30 },
            ],
          },
        },
      });
      const toppings = await tx.modifierGroup.create({
        data: {
          nameKm: "បន្ថែម",
          nameEn: "Extras",
          minSelect: 0,
          maxSelect: 3,
          sortOrder: 30,
          options: {
            create: [
              { nameKm: "ស៊ុតពណ៌", nameEn: "Extra egg", priceDeltaCents: 50, sortOrder: 10 },
              { nameKm: "បន្លែបន្ថែម", nameEn: "Extra vegetables", priceDeltaCents: 50, sortOrder: 20 },
            ],
          },
        },
      });

      const item = (categoryId: string, stationId: string, nameKm: string, nameEn: string, priceCents: number, sortOrder: number, groupIds: string[]) =>
        tx.menuItem.create({
          data: {
            categoryId,
            stationId,
            nameKm,
            nameEn,
            priceCents,
            sortOrder,
            modifierGroups: { create: groupIds.map((modifierGroupId, index) => ({ modifierGroupId, sortOrder: index })) },
          },
        });

      await item(drinks.id, bar.id, "កាហ្វេទឹកដោះគោ", "Milk coffee", 250, 10, [size.id, sugar.id]);
      await item(drinks.id, bar.id, "តែបៃតង", "Green tea", 200, 20, [size.id, sugar.id]);
      await item(drinks.id, bar.id, "ទឹកក្រូច", "Orange juice", 300, 30, [size.id]);
      await item(drinks.id, bar.id, "ទឹកសុទ្ធ", "Water", 50, 40, []);
      await item(mains.id, kitchen.id, "បាយឆា", "Fried rice", 450, 10, [toppings.id]);
      await item(mains.id, kitchen.id, "មីឆា", "Fried noodles", 450, 20, [toppings.id]);
      await item(mains.id, kitchen.id, "ឡុកឡាក់សាច់គោ", "Beef lok lak", 650, 30, [toppings.id]);
      await item(extras.id, kitchen.id, "ស៊ុតចៀន", "Fried egg", 100, 10, []);

      await tx.auditLog.create({
        data: { action: "menu.demo_seeded", details: { source: "seed-demo-menu script" } },
      });
    });

    console.log("Demo menu created. Open Menu in the app to see it.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Could not create the demo menu:", error instanceof Error ? error.message : error);
  process.exit(1);
});
