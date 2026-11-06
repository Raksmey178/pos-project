import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { getOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const GET = handle(async (_request: Request, ctx: RouteContext<"/api/orders/[id]">) => {
  await requireStaff("orders:view");
  return NextResponse.json({ order: await getOrder(parseId((await ctx.params).id)) });
});
