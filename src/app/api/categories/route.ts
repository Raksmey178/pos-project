import { NextResponse } from "next/server";
import { createCategorySchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createCategory } from "@/server/services/menu";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("menu:manage");
  const input = await parseJson(request, createCategorySchema);
  return NextResponse.json({ category: await createCategory(actor, input) }, { status: 201 });
});
