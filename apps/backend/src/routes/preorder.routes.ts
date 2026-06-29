import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";
import {
  createPreOrderController,
  verifyBookingController,
  getMyPreOrdersController,
  getPreOrderByIdController,
  getPreOrderByTokenController,
  createBalancePaymentController,
  verifyBalancePaymentController,
} from "../controllers/preorder.controllers";

export const preOrderRouter: Router = Router();

// Public, token-gated balance endpoints (no auth — reached from the emailed link)
preOrderRouter.get("/pay/:token", getPreOrderByTokenController);
preOrderRouter.post("/pay/:token/create-payment", orderRateLimiter, createBalancePaymentController);
preOrderRouter.post("/pay/:token/verify", orderRateLimiter, verifyBalancePaymentController);

// Authenticated customer endpoints
preOrderRouter.use(authMiddleware);
preOrderRouter.post("/", orderRateLimiter, createPreOrderController);
preOrderRouter.get("/", getMyPreOrdersController);
preOrderRouter.get("/:id", getPreOrderByIdController);
preOrderRouter.post("/:id/booking/verify", orderRateLimiter, verifyBookingController);
