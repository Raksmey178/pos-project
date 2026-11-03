import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle } from "@/server/http";
import { getOrderableMenu } from "@/server/services/menu";

export const dynamic = "force-dynamic";

// The menu as the ordering screens need it. Every role may read it.
export const GET = handle(async () => {
  await requireStaff("menu:view");
  return NextResponse.json(await getOrderableMenu());
});
