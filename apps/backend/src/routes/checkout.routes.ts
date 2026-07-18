import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware"; 
import { cartMiddleware } from "../middlewares/cart.middleware";
import { calculateCheckoutController, checkServiceabilityController } from "../controllers/checkout.controllers";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";

export const checkoutRouter: Router = Router();

checkoutRouter.post("/calculate", authMiddleware, cartMiddleware, orderRateLimiter, calculateCheckoutController);

checkoutRouter.get("/serviceability", authMiddleware, orderRateLimiter, checkServiceabilityController);