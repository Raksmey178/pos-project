import { NextResponse } from "next/server";
import { resetPinSchema } from "@/lib/schemas/staff";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { resetStaffPin } from "@/server/services/staff";

export const POST = handle(async (request: Request, ctx: RouteContext<"/api/staff/[id]/pin">) => {
  const actor = await requireStaff("staff:manage");
  const id = parseId((await ctx.params).id);
  const { pin } = await parseJson(request, resetPinSchema);
  await resetStaffPin(actor, id, pin);
  return NextResponse.json({ ok: true });
});
