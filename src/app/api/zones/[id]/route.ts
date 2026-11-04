import { NextResponse } from "next/server";
import { updateZoneSchema } from "@/lib/schemas/tables";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateZone } from "@/server/services/tables";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/zones/[id]">) => {
  const actor = await requireStaff("tables:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateZoneSchema);
  return NextResponse.json({ zone: await updateZone(actor, id, input) });
});
