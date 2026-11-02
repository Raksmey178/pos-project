import { NextResponse } from "next/server";
import { handle } from "@/server/http";
import { listLoginOptions } from "@/server/services/auth";

export const dynamic = "force-dynamic";

// Public on purpose: the login screen needs the list of names to show.
// Only id and name are returned, never roles.
export const GET = handle(async () => {
  return NextResponse.json({ staff: await listLoginOptions() });
});
