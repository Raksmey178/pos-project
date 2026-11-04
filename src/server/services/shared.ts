import { isUniqueViolation } from "@/server/db-errors";
import { ApiError } from "@/server/errors";

type MaxSort = Promise<{ _max: { sortOrder: number | null } }>;

/** New things go to the end of their list. */
export async function nextSortOrder(aggregate: MaxSort): Promise<number> {
  return ((await aggregate)._max.sortOrder ?? 0) + 10;
}

/** Runs the work; a "this name already exists" database error becomes a clean 409. */
export async function guardUnique<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, "CONFLICT");
    throw error;
  }
}

export const notFound = () => new ApiError(404, "NOT_FOUND");
export const invalid = () => new ApiError(400, "INVALID_INPUT");
