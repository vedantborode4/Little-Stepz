import rateLimit from "express-rate-limit";
import { PhoneErrorCode } from "../utils/phoneErrors";

/**
 * IP limiters for phone OTP.
 *
 * These are a cheap first line only — the express-rate-limit store is in-memory and
 * per-process, so it degrades to per-instance and resets on restart. The DB-backed
 * daily caps in `phoneVerification.services.ts` are the control that actually bounds
 * the SMS bill.
 *
 * `skipSuccessfulRequests` MUST stay false. `authRateLimiter` sets it to true, and
 * behind that a successful send — precisely the request that costs money — would
 * consume zero quota.
 */
export const phoneOtpSendIpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: PhoneErrorCode.OTP_RATE_LIMITED });
  },
});

// Loose enough that the per-challenge attempt cap is the real brute-force guard.
export const phoneOtpVerifyIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: PhoneErrorCode.OTP_RATE_LIMITED });
  },
});
