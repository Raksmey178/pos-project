import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { removeItem } from "@/server/services/orders";

export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/orders/[id]/items/[itemId]/remove">) => {
  const actor = await requireStaff("orders:edit");
  const { id, itemId } = await ctx.params;
  return NextResponse.json({ order: await removeItem(actor, parseId(id), parseId(itemId)) });
});
