import type { ErrorCode } from "@/lib/error-codes";

/** An expected failure (wrong PIN, no permission, ...). The route turns it into an HTTP answer. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly extra?: Record<string, string | number>,
  ) {
    super(code);
    this.name = "ApiError";
  }
}
