import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * In-memory store: correct for a single process. If the API is ever run in PM2
 * cluster mode, move these to a shared store (Redis) or limits multiply per worker.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  skip: () => env.NODE_ENV === "test",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } });
  },
});
