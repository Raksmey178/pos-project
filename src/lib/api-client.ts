import { isErrorCode, type ErrorCode } from "./error-codes";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; lockedUntil?: string };

/** Small helper the screens use to call our own API. Always resolves; never throws. */
export async function callApi<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? "{}" : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      error: isErrorCode(data.error) ? data.error : "INTERNAL",
      lockedUntil: typeof data.lockedUntil === "string" ? data.lockedUntil : undefined,
    };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

/** "2026-11-02T10:15:00.000Z" -> "17:15" in the device's own time zone. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
