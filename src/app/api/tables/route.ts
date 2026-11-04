import { NextResponse } from "next/server";
import { createTableSchema } from "@/lib/schemas/tables";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createTable } from "@/server/services/tables";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("tables:manage");
  const input = await parseJson(request, createTableSchema);
  return NextResponse.json({ table: await createTable(actor, input) }, { status: 201 });
});
