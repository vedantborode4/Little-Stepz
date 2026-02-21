import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createPaymentController,
  verifyPaymentController,
  createCodPaymentController,
} from "../controllers/payment.controllers";
import {
  paymentCreateRateLimiter,
  paymentVerifyRateLimiter,
  codPaymentRateLimiter,
} from "../middlewares/paymentRateLimiter.middleware";

export const paymentRouter: Router = Router();

paymentRouter.use(authMiddleware);


paymentRouter.post(
  "/create",
  paymentCreateRateLimiter,
  createPaymentController
);


paymentRouter.post(
  "/verify",
  paymentVerifyRateLimiter,
  verifyPaymentController
);


paymentRouter.post(
  "/cod",
  codPaymentRateLimiter,
  createCodPaymentController
);
