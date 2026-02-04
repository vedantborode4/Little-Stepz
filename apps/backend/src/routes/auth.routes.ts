import { Router } from "express";
import { logoutController, refreshController, signinController, signupController } from "../controllers/auth.controllers";
import { authRateLimiter } from "../middlewares/authRateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRouter: Router = Router();

authRouter.post("/signup", authRateLimiter, signupController);
authRouter.post("/signin", authRateLimiter, signinController);
authRouter.post("/logout", authMiddleware, logoutController);

authRouter.post("/refresh", refreshController);
