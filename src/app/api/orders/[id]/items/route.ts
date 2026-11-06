import { NextResponse } from "next/server";
import { addOrderItemSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { addItem } from "@/server/services/orders";

// The price is never sent by the screen: the server takes it from the menu.
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/orders/[id]/items">) => {
  const actor = await requireStaff("orders:edit");
  const orderId = parseId((await ctx.params).id);
  const input = await parseJson(request, addOrderItemSchema);
  return NextResponse.json({ order: await addItem(actor, orderId, input) });
});
