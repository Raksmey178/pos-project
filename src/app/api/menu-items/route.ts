import { NextResponse } from "next/server";
import { createMenuItemSchema } from "@/lib/schemas/menu";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { createMenuItem } from "@/server/services/menu";

export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("menu:manage");
  const input = await parseJson(request, createMenuItemSchema);
  return NextResponse.json({ item: await createMenuItem(actor, input) }, { status: 201 });
});
