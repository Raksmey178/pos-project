import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { recordTicketPrint } from "@/server/services/kitchen";

// Called when someone presses Print, so every print and reprint is counted and logged.
export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/kitchen/tickets/[id]/print">) => {
  const actor = await requireStaff("kitchen:view");
  const printCount = await recordTicketPrint(actor, parseId((await ctx.params).id));
  return NextResponse.json({ printCount });
});
