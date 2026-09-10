import { Router, type RequestHandler } from "express";
import { isSignupEmailOtpEnabled } from "../services/auth.services";
import {
  appleController,
  forgotPasswordController,
  googleController,
  logoutController,
  refreshController,
  resetPasswordController,
  requestSignupOtpController,
  signinController,
  signupController,
  verifyResetCodeController,
  verifySignupOtpController,
} from "../controllers/auth.controllers";
import {
  authRateLimiter,
  passwordResetRequestRateLimiter,
  passwordResetVerifyRateLimiter,
  signupOtpRequestRateLimiter,
  signupOtpVerifyRateLimiter,
} from "../middlewares/authRateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRouter: Router = Router();

// Two-step signup: the code is emailed first, and the User row is only created once
// it's redeemed. There is deliberately no /signup/resend — re-POSTing /signup/request
// with the same payload supersedes the outstanding code, which keeps the cooldown and
// send-count enforcement in exactly one place.
authRouter.post("/signup/request", signupOtpRequestRateLimiter, requestSignupOtpController);
authRouter.post("/signup/verify", signupOtpVerifyRateLimiter, verifySignupOtpController);

// One-step signup while SIGNUP_EMAIL_OTP_ENABLED=false; otherwise 426 "update required",
// which current clients treat as "use the code flow" and older builds show as-is.
//
// The 426 is not rate-limited: every current client calls /signup before the code flow,
// and counting those under authRateLimiter (shared with /signin, /google and /apple, and
// blind to non-2xx "successes") locked sign-in for a whole IP after ~10 signup submits.
// When one-step signup is live it creates accounts, so it takes the signup limiter.
const oneStepSignupRateLimiter: RequestHandler = (req, res, next) =>
  isSignupEmailOtpEnabled() ? next() : signupOtpRequestRateLimiter(req, res, next);

authRouter.post("/signup", oneStepSignupRateLimiter, signupController);
authRouter.post("/signin", authRateLimiter, signinController);
authRouter.post("/google", authRateLimiter, googleController);
authRouter.post("/apple", authRateLimiter, appleController);
authRouter.post("/logout", authMiddleware, logoutController);

authRouter.post("/forgot-password", passwordResetRequestRateLimiter, forgotPasswordController);
authRouter.post("/verify-reset-code", passwordResetVerifyRateLimiter, verifyResetCodeController);
authRouter.post("/reset-password", passwordResetVerifyRateLimiter, resetPasswordController);

authRouter.post("/refresh", refreshController);
