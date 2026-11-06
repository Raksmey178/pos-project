import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle } from "@/server/http";
import { getKitchenBoard } from "@/server/services/kitchen";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireStaff("kitchen:view");
  return NextResponse.json(await getKitchenBoard());
});
