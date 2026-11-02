import { NextResponse } from "next/server";
import { createStaffSchema } from "@/lib/schemas/staff";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createStaff, listStaff } from "@/server/services/staff";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireStaff("staff:view");
  return NextResponse.json({ staff: await listStaff() });
});

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("staff:manage");
  const input = await parseJson(request, createStaffSchema);
  return NextResponse.json({ staff: await createStaff(actor, input) }, { status: 201 });
});
