import { NextResponse } from "next/server";
import { updateStationSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateStation } from "@/server/services/menu";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/stations/[id]">) => {
  const actor = await requireStaff("menu:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateStationSchema);
  return NextResponse.json({ station: await updateStation(actor, id, input) });
});
