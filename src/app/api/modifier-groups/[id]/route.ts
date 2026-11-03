import { NextResponse } from "next/server";
import { updateModifierGroupSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateModifierGroup } from "@/server/services/menu";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/modifier-groups/[id]">) => {
  const actor = await requireStaff("menu:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateModifierGroupSchema);
  return NextResponse.json({ group: await updateModifierGroup(actor, id, input) });
});
