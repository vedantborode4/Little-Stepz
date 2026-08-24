import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createPaymentController,
  verifyPaymentController,
  codRetiredController,
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


// Cash on Delivery has been withdrawn. The route stays mounted so the mobile
// builds already published to the stores fail with a mapped error code they can
// show the customer, rather than a bare 404 they render as "Something went wrong".
paymentRouter.post("/cod", codRetiredController);
