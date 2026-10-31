import { execSync } from "child_process";
import { CRM_DB_DIR, testDatabaseUrl } from "./test-env";

/**
 * Brings the test database up to the latest migration. Deliberately not a reset:
 * tests create uniquely named data and never assume an empty database, so the
 * suite stays non-destructive and can be re-run freely.
 */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: CRM_DB_DIR,
    env: { ...process.env, CRM_DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
