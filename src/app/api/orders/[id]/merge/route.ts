import { NextResponse } from "next/server";
import { mergeOrdersSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { mergeOrders } from "@/server/services/orders";

// Merges ANOTHER order into this one: this order is the one that stays.
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/orders/[id]/merge">) => {
  const actor = await requireStaff("orders:edit");
  const targetId = parseId((await ctx.params).id);
  const { sourceOrderId } = await parseJson(request, mergeOrdersSchema);
  return NextResponse.json({ order: await mergeOrders(actor, targetId, sourceOrderId) });
});
