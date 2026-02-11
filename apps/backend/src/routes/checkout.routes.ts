import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware"; 
import { cartMiddleware } from "../middlewares/cart.middleware";
import { calculateCheckoutController } from "../controllers/checkout.controllers";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";

export const checkoutRouter: Router = Router();

checkoutRouter.post("/calculate", authMiddleware, cartMiddleware, orderRateLimiter, calculateCheckoutController);