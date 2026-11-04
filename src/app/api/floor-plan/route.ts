import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle } from "@/server/http";
import { getFloorPlan } from "@/server/services/tables";

export const dynamic = "force-dynamic";

// The floor plan with table statuses. Every role may read it.
export const GET = handle(async () => {
  await requireStaff("tables:view");
  return NextResponse.json(await getFloorPlan());
});
