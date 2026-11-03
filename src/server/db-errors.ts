/** A UNIQUE rule was broken (for example a name that already exists). Prisma error code P2002. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
