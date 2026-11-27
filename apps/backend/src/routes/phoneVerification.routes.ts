import { Router } from "express";
import { authOrGuestMiddleware } from "../middlewares/auth.middleware";
import {
  phoneOtpSendIpRateLimiter,
  phoneOtpVerifyIpRateLimiter,
} from "../middlewares/phoneOtpRateLimit.middleware";
import {
  getVerifiedPhonesController,
  sendPhoneOtpController,
  verifyPhoneOtpController,
} from "../controllers/phoneVerification.controllers";

export const phoneVerificationRouter: Router = Router();

// Auth required: the per-user daily caps are only expressible against a userId, and
// they're what stops account-farming from multiplying the SMS spend.
// Guests verify a delivery number too; only verifications from their own session count.
phoneVerificationRouter.use(authOrGuestMiddleware);

// No /resend — re-POSTing /otp/send reuses the live challenge, so cooldown and
// send-count enforcement live in exactly one place.
phoneVerificationRouter.post("/otp/send", phoneOtpSendIpRateLimiter, sendPhoneOtpController);
phoneVerificationRouter.post("/otp/verify", phoneOtpVerifyIpRateLimiter, verifyPhoneOtpController);
phoneVerificationRouter.get("/verified", getVerifiedPhonesController);
