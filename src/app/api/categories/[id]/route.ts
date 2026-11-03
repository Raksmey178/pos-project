import { NextResponse } from "next/server";
import { updateCategorySchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateCategory } from "@/server/services/menu";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/categories/[id]">) => {
  const actor = await requireStaff("menu:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateCategorySchema);
  return NextResponse.json({ category: await updateCategory(actor, id, input) });
});
