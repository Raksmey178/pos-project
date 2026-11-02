import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas/auth";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { env } from "@/server/env";
import { handle, parseJson } from "@/server/http";
import { login } from "@/server/services/auth";

// Public (nobody is logged in yet). Wrong PINs are counted and lock the account.
export const POST = handle(async (request: Request) => {
  const input = await parseJson(request, loginSchema);
  const { token, expiresAt, staff } = await login(input);

  const response = NextResponse.json({ staff });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript in the page cannot read it
    sameSite: "lax", // not sent on cross-site POSTs
    secure: env.NODE_ENV === "production", // production must use HTTPS
    path: "/",
    expires: expiresAt,
  });
  return response;
});
