import { NextResponse } from "next/server";
import { getSessionToken } from "@/server/auth/current-staff";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { env } from "@/server/env";
import { handle } from "@/server/http";
import { findStaffBySessionToken, logout } from "@/server/services/auth";

// Safe to call when already logged out; it just clears the cookie.
export const POST = handle(async () => {
  const token = await getSessionToken();
  if (token) await logout(token, await findStaffBySessionToken(token));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
});
