import { Router } from "express";
import { authOrGuestMiddleware, noGuestMiddleware } from "../middlewares/auth.middleware";
import { guestPreOrderParam } from "../middlewares/guestScope.middleware";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";
import { documentRateLimiter } from "../middlewares/documentRateLimiter.middleware";
import {
  createPreOrderController,
  verifyBookingController,
  getMyPreOrdersController,
  getPreOrderByIdController,
  getPreOrderByTokenController,
  createBalancePaymentController,
  verifyBalancePaymentController,
  getPreOrderReceiptController,
} from "../controllers/preorder.controllers";

export const preOrderRouter: Router = Router();

// Public, token-gated balance endpoints (no auth — reached from the emailed link)
preOrderRouter.get("/pay/:token", getPreOrderByTokenController);
preOrderRouter.post("/pay/:token/create-payment", orderRateLimiter, createBalancePaymentController);
preOrderRouter.post("/pay/:token/verify", orderRateLimiter, verifyBalancePaymentController);

// Authenticated customer endpoints
preOrderRouter.use(authOrGuestMiddleware);
preOrderRouter.param("id", guestPreOrderParam);
preOrderRouter.post("/", orderRateLimiter, createPreOrderController);
preOrderRouter.get("/", noGuestMiddleware, getMyPreOrdersController);
preOrderRouter.get("/:id", getPreOrderByIdController);
preOrderRouter.post("/:id/booking/verify", orderRateLimiter, verifyBookingController);
preOrderRouter.get("/:id/receipt", documentRateLimiter, getPreOrderReceiptController);
