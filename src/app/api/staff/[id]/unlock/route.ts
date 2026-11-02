import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { unlockStaff } from "@/server/services/staff";

export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/staff/[id]/unlock">) => {
  const actor = await requireStaff("staff:manage");
  await unlockStaff(actor, parseId((await ctx.params).id));
  return NextResponse.json({ ok: true });
});
