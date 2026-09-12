import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware"; 
import { cartMiddleware } from "../middlewares/cart.middleware";
import { calculateCheckoutController, checkServiceabilityController } from "../controllers/checkout.controllers";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";
import { serviceabilityRateLimiter } from "../middlewares/serviceabilityRateLimiter.middleware";

export const checkoutRouter: Router = Router();

checkoutRouter.post("/calculate", authMiddleware, cartMiddleware, orderRateLimiter, calculateCheckoutController);

// Public: the product page lets shoppers check a pincode before signing in. It reads
// nothing account-specific. Its own limiter, so lookups never spend the order bucket
// that the public pre-order balance payment routes share.
checkoutRouter.get("/serviceability", serviceabilityRateLimiter, checkServiceabilityController);