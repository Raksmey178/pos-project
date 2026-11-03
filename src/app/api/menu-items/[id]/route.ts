import { NextResponse } from "next/server";
import { updateMenuItemSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateMenuItem } from "@/server/services/menu";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/menu-items/[id]">) => {
  const actor = await requireStaff("menu:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateMenuItemSchema);
  return NextResponse.json({ item: await updateMenuItem(actor, id, input) });
});
