import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId } from "@/server/http";
import { revokeStaffSessions } from "@/server/services/staff";

export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/staff/[id]/sessions/revoke">) => {
  const actor = await requireStaff("staff:manage");
  const count = await revokeStaffSessions(actor, parseId((await ctx.params).id));
  return NextResponse.json({ revoked: count });
});
