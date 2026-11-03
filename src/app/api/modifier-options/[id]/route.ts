import { NextResponse } from "next/server";
import { updateModifierOptionSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateModifierOption } from "@/server/services/menu";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/modifier-options/[id]">) => {
  const actor = await requireStaff("menu:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateModifierOptionSchema);
  return NextResponse.json({ option: await updateModifierOption(actor, id, input) });
});
