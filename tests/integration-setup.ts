import { randomUUID } from "node:crypto";

/** Integration tests run only when TEST_DATABASE_URL is set (see README). */
export function integrationEnabled(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL);
}

/** Points the app's database client at the TEST database. Refuses anything not named *_test. */
export function setupIntegrationEnv(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name ends with _test (tests write data)");
  }
  process.env.DATABASE_URL = url;
}

export const uniqueName = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;
