import { NextResponse } from "next/server";
import { updateTableSchema } from "@/lib/schemas/tables";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseId, parseJson } from "@/server/http";
import { updateTable } from "@/server/services/tables";

export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/tables/[id]">) => {
  const actor = await requireStaff("tables:manage");
  const id = parseId((await ctx.params).id);
  const input = await parseJson(request, updateTableSchema);
  return NextResponse.json({ table: await updateTable(actor, id, input) });
});
