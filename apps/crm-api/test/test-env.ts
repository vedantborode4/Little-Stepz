import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "dotenv";

/**
 * Tests run against `<dev database>_test` in the same crm-postgres container,
 * derived from packages/crm-db/.env so no extra secret file is needed. The dev
 * database itself is never touched.
 */
export function testDatabaseUrl(): string {
  const dbEnv = parse(readFileSync(resolve(__dirname, "../../../packages/crm-db/.env")));
  const url = new URL(dbEnv.CRM_DATABASE_URL ?? "");
  url.pathname = `${url.pathname.replace(/_test$/, "")}_test`;
  return url.toString();
}

export const CRM_DB_DIR = resolve(__dirname, "../../../packages/crm-db");
