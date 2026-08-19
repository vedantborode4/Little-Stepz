import { Router } from "express";
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

// Retained so shipped app builds get 426 "update required" rather than a bare 404.
authRouter.post("/signup", authRateLimiter, signupController);
authRouter.post("/signin", authRateLimiter, signinController);
authRouter.post("/google", authRateLimiter, googleController);
authRouter.post("/apple", authRateLimiter, appleController);
authRouter.post("/logout", authMiddleware, logoutController);

authRouter.post("/forgot-password", passwordResetRequestRateLimiter, forgotPasswordController);
authRouter.post("/verify-reset-code", passwordResetVerifyRateLimiter, verifyResetCodeController);
authRouter.post("/reset-password", passwordResetVerifyRateLimiter, resetPasswordController);

authRouter.post("/refresh", refreshController);
