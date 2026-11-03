import { NextResponse } from "next/server";
import { createStationSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createStation } from "@/server/services/menu";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("menu:manage");
  const input = await parseJson(request, createStationSchema);
  return NextResponse.json({ station: await createStation(actor, input) }, { status: 201 });
});
