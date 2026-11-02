import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Public on purpose (no login needed): it only answers "can the app reach its
// database?". It never returns error text, connection strings or business data.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Full error details only while developing. Real logging arrives in Phase 2.
    if (process.env.NODE_ENV !== "production") console.error(error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
