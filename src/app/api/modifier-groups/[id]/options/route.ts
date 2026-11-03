import { NextResponse } from "next/server";
import { createModifierOptionSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { createModifierOption } from "@/server/services/menu";

export const POST = handle(async (request: Request, ctx: RouteContext<"/api/modifier-groups/[id]/options">) => {
  const actor = await requireStaff("menu:manage");
  const groupId = parseId((await ctx.params).id);
  const input = await parseJson(request, createModifierOptionSchema);
  return NextResponse.json({ option: await createModifierOption(actor, groupId, input) }, { status: 201 });
});
