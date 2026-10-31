import { Router } from "express";
import { authenticate } from "../../core/auth";
import { loginRateLimiter } from "../../core/rateLimit";
import * as controller from "./auth.controller";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimiter, controller.login);
authRoutes.post("/refresh", controller.refresh);
authRoutes.post("/logout", controller.logout);
authRoutes.get("/me", authenticate, controller.me);
authRoutes.post("/change-password", authenticate, controller.changePassword);
