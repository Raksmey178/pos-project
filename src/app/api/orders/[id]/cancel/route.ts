import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { cancelEmptyOrder } from "@/server/services/orders";

export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/orders/[id]/cancel">) => {
  const actor = await requireStaff("orders:edit");
  return NextResponse.json({ order: await cancelEmptyOrder(actor, parseId((await ctx.params).id)) });
});
