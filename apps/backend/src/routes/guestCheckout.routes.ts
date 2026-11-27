import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PhoneErrorCode } from "../utils/phoneErrors";
import {
  startGuestCheckoutController,
  verifyGuestCheckoutController,
} from "../controllers/guestCheckout.controllers";

/**
 * Public: guest checkout starts before there is any session. Own limiter instances (a shared
 * one would share its bucket with unrelated features); like the phone-OTP limiters they are a
 * cheap first line, and the DB-backed daily caps in phoneVerification.services bound the SMS bill.
 */
const limited = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message: PhoneErrorCode.OTP_RATE_LIMITED });
    },
  });

export const guestCheckoutRouter: Router = Router();

guestCheckoutRouter.post("/start", limited(60 * 60 * 1000, 10), startGuestCheckoutController);
guestCheckoutRouter.post("/verify", limited(15 * 60 * 1000, 20), verifyGuestCheckoutController);
