import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";

/**
 * Throttle pincode serviceability checks.
 *
 * Deliberately its own bucket rather than `orderRateLimiter`: the check is public, so
 * anonymous shoppers are keyed by IP, and sharing that bucket would let a few pincode
 * lookups 429 the public pre-order balance `create-payment` / `verify` calls from the
 * same address — leaving a captured Razorpay payment unconfirmed. A lookup is a cheap
 * read, so it is bounded more loosely than a write.
 */
const serviceabilityRequests = new Map<string, { count: number; lastReset: number }>();
const SERVICEABILITY_RATE_LIMIT = 30; // 30 checks per minute per user/IP
const WINDOW_MS = 60 * 1000;

export const serviceabilityRateLimiter = (req: Request, _res: Response, next: NextFunction) => {
  const key = req.user?.userId || req.ip || "anonymous";
  const now = Date.now();
  let record = serviceabilityRequests.get(key);

  if (!record || now - record.lastReset > WINDOW_MS) {
    record = { count: 1, lastReset: now };
  } else {
    record.count++;
    if (record.count > SERVICEABILITY_RATE_LIMIT) {
      throw new ApiError(429, OrderErrorCode.RATE_LIMIT_EXCEEDED, {
        value: ["Too many pincode checks"],
      });
    }
  }

  serviceabilityRequests.set(key, record);
  next();
};
