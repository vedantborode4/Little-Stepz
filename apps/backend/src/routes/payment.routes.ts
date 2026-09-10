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


// Confirm a Cash on Delivery order. The COD gates ran at order creation; this re-checks the
// per-customer ones under lock and confirms without charging anything.
paymentRouter.post("/cod", paymentCreateRateLimiter, createCodPaymentController);
