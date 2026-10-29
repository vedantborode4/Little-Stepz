import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/test-env";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Files share one database; running them one at a time keeps assertions deterministic.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      CRM_DATABASE_URL: testDatabaseUrl(),
      ACCESS_TOKEN_SECRET: "test-only-secret-that-is-at-least-32-chars-long",
      BCRYPT_ROUNDS: "10",
      CORS_ORIGIN: "http://localhost:3100",
    },
  },
});
