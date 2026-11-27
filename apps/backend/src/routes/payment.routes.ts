import { Router } from "express";
import { authOrGuestMiddleware } from "../middlewares/auth.middleware";
import { guestOrderBodyScope } from "../middlewares/guestScope.middleware";
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

// Guests pay for orders placed in their own session only (the order id is in the body).
paymentRouter.use(authOrGuestMiddleware, guestOrderBodyScope);


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
