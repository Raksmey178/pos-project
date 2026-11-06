import { NextResponse } from "next/server";
import { itemStatusChangeSchema } from "@/lib/schemas/orders";
import { requireStaff } from "@/server/auth/current-staff";
import { handle, parseJson } from "@/server/http";
import { setItemsStatus } from "@/server/services/kitchen";

// Anyone on the kitchen board may call this; WHICH step they may make depends on their role
// (the kitchen prepares, the floor serves), and the service checks that for every request.
export const POST = handle(async (request: Request) => {
  const actor = await requireStaff("kitchen:view");
  const input = await parseJson(request, itemStatusChangeSchema);
  return NextResponse.json(await setItemsStatus(actor, input));
});
