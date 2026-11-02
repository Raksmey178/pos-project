import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/server/errors";
import { findStaffBySessionToken, type AuthedStaff } from "@/server/services/auth";
import { hasPermission, type Permission } from "./permissions";
import { SESSION_COOKIE } from "./session-token";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The logged-in person, or null. Looked up in the database on every request, so switching someone off takes effect at once. */
export async function getCurrentStaff(): Promise<AuthedStaff | null> {
  const token = await getSessionToken();
  return token ? findStaffBySessionToken(token) : null;
}

/** For API routes: call this FIRST in every route. Throws 401 (not logged in) or 403 (not allowed). */
export async function requireStaff(permission?: Permission): Promise<AuthedStaff> {
  const staff = await getCurrentStaff();
  if (!staff) throw new ApiError(401, "UNAUTHENTICATED");
  if (permission && !hasPermission(staff.role, permission)) throw new ApiError(403, "FORBIDDEN");
  return staff;
}

/** For pages: sends visitors to the login screen (or home) instead of throwing. */
export async function requirePageStaff(permission?: Permission): Promise<AuthedStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (permission && !hasPermission(staff.role, permission)) redirect("/");
  return staff;
}
