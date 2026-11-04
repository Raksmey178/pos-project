import { NextResponse } from "next/server";
import { createZoneSchema } from "@/lib/schemas/tables";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createZone } from "@/server/services/tables";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("tables:manage");
  const input = await parseJson(request, createZoneSchema);
  return NextResponse.json({ zone: await createZone(actor, input) }, { status: 201 });
});
