import { NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createOrder, listOpenOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireStaff("orders:view");
  return NextResponse.json({ orders: await listOpenOrders() });
});

// 201 = a new order. 200 = the same request was sent again, here is the order it made the first time.
export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("orders:edit");
  const input = await parseJson(request, createOrderSchema);
  const { order, created } = await createOrder(actor, input);
  return NextResponse.json({ order }, { status: created ? 201 : 200 });
});
