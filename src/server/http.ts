import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./errors";

/** Wrap every route in this: expected errors become clean JSON, unexpected ones become a plain 500. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.code, ...error.extra }, { status: error.status });
      }
      // Never put request data or error messages into production logs (they can hold personal data).
      if (process.env.NODE_ENV !== "production") console.error(error);
      else console.error("Unhandled API error:", error instanceof Error ? error.name : "unknown");
      return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
    }
  };
}

/** Reads the JSON body and checks it against a zod schema. Anything else is a 400. */
export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  // Browsers cannot send application/json from another website without permission,
  // so requiring it also blocks simple cross-site form posts.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(400, "INVALID_INPUT");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_INPUT");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "INVALID_INPUT");
  return parsed.data;
}

/** Route parameters like [id] come from the URL, so check them before touching the database. */
export function parseId(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND");
  return parsed.data;
}
