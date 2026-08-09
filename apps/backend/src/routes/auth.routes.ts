import { Router } from "express";
import {
  appleController,
  forgotPasswordController,
  googleController,
  logoutController,
  refreshController,
  resetPasswordController,
  signinController,
  signupController,
  verifyResetCodeController,
} from "../controllers/auth.controllers";
import {
  authRateLimiter,
  passwordResetRequestRateLimiter,
  passwordResetVerifyRateLimiter,
} from "../middlewares/authRateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRouter: Router = Router();

authRouter.post("/signup", authRateLimiter, signupController);
authRouter.post("/signin", authRateLimiter, signinController);
authRouter.post("/google", authRateLimiter, googleController);
authRouter.post("/apple", authRateLimiter, appleController);
authRouter.post("/logout", authMiddleware, logoutController);

authRouter.post("/forgot-password", passwordResetRequestRateLimiter, forgotPasswordController);
authRouter.post("/verify-reset-code", passwordResetVerifyRateLimiter, verifyResetCodeController);
authRouter.post("/reset-password", passwordResetVerifyRateLimiter, resetPasswordController);

authRouter.post("/refresh", refreshController);
