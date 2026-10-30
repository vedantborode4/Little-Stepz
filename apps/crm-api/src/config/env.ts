import { z } from "zod";

/** `KEY=` in a .env file means "not set", not an empty value. */
const blankAsMissing = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8100),
    /** Loopback by default: only nginx (or the web app's proxy) on the same host reaches the API. */
    HOST: z.string().default("127.0.0.1"),
    CRM_DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:3100")
      .transform((v) =>
        v
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.string().default("info"),
    /** Read-only website pull: off, built-in demo data, or the real site's export endpoints. */
    WEBSITE_SYNC_MODE: z.enum(["off", "mock", "live"]).default("off"),
    WEBSITE_SYNC_URL: blankAsMissing(z.string().url().optional()),
    WEBSITE_SYNC_KEY: blankAsMissing(z.string().min(32, "WEBSITE_SYNC_KEY must be at least 32 characters").optional()),
  })
  .superRefine((e, ctx) => {
    if (e.WEBSITE_SYNC_MODE === "live" && (!e.WEBSITE_SYNC_URL || !e.WEBSITE_SYNC_KEY)) {
      ctx.addIssue({ code: "custom", path: ["WEBSITE_SYNC_MODE"], message: "live sync needs WEBSITE_SYNC_URL and WEBSITE_SYNC_KEY" });
    }
    if (e.WEBSITE_SYNC_MODE === "mock" && e.NODE_ENV === "production") {
      ctx.addIssue({ code: "custom", path: ["WEBSITE_SYNC_MODE"], message: "mock sync data is not allowed in production" });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid crm-api environment:\n${problems}`);
  }
  return parsed.data;
}

export const env = loadEnv();
