import { NextResponse } from "next/server";
import { transferTableSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { transferTable } from "@/server/services/orders";

export const POST = handle(async (request: Request, ctx: RouteContext<"/api/orders/[id]/transfer">) => {
  const actor = await requireStaff("orders:edit");
  const orderId = parseId((await ctx.params).id);
  const { fromTableId, toTableId } = await parseJson(request, transferTableSchema);
  return NextResponse.json({ order: await transferTable(actor, orderId, fromTableId, toTableId) });
});
