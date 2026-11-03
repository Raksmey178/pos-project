import { NextResponse } from "next/server";
import { createModifierGroupSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createModifierGroup } from "@/server/services/menu";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("menu:manage");
  const input = await parseJson(request, createModifierGroupSchema);
  return NextResponse.json({ group: await createModifierGroup(actor, input) }, { status: 201 });
});
