import { NextResponse } from "next/server";
import { updateStaffSchema } from "@/lib/schemas/staff";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateStaff } from "@/server/services/staff";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/staff/[id]">) => {
  const actor = await requireStaff("staff:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateStaffSchema);
  return NextResponse.json({ staff: await updateStaff(actor, id, input) });
});
