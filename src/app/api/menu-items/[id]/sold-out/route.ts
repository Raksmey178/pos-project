import { NextResponse } from "next/server";
import { setSoldOutSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { setItemSoldOut } from "@/server/services/menu";

// A separate permission: the kitchen may mark items sold out without being able to change prices.
export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/menu-items/[id]/sold-out">) => {
  const actor = await requireStaff("menu:soldout");
  const id = parseId((await ctx.params).id);
  const { isSoldOut } = await parseJson(request, setSoldOutSchema);
  return NextResponse.json({ item: await setItemSoldOut(actor, id, isSoldOut) });
});
