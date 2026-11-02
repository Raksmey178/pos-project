import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/current-staff";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const staff = await requireStaff();
  return NextResponse.json({ staff });
});
