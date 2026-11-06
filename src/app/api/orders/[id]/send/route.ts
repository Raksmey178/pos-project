import { NextResponse } from "next/server";
import { sendToKitchenSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { sendToKitchen } from "@/server/services/kitchen";

// Sends the order's new items to the kitchen. 201 = new tickets, 200 = the same request again.
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/orders/[id]/send">) => {
  const actor = await requireStaff("orders:edit");
  const orderId = parseId((await ctx.params).id);
  const { clientSendId } = await parseJson(request, sendToKitchenSchema);
  const { order, tickets, created } = await sendToKitchen(actor, orderId, clientSendId);
  return NextResponse.json({ order, tickets }, { status: created ? 201 : 200 });
});
