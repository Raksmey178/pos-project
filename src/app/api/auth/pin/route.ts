import { NextResponse } from "next/server";
import { changeOwnPinSchema } from "@/lib/schemas/auth";
import { getSessionToken, requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { changeOwnPin } from "@/server/services/auth";

// Any logged-in person can change their own PIN (they must know the current one).
export const POST = handle(async (request: Request) => {
  const actor = await requireStaff();
  const input = await parseJson(request, changeOwnPinSchema);
  await changeOwnPin(actor, (await getSessionToken()) ?? "", input);
  return NextResponse.json({ ok: true });
});
