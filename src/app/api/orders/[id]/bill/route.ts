import { NextResponse } from "next/server";
import { billSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { setBillRequested } from "@/server/services/orders";

export const POST = handle(async (request: Request, ctx: RouteContext<"/api/orders/[id]/bill">) => {
  const actor = await requireStaff("orders:edit");
  const orderId = parseId((await ctx.params).id);
  const { requested } = await parseJson(request, billSchema);
  return NextResponse.json({ order: await setBillRequested(actor, orderId, requested) });
});
