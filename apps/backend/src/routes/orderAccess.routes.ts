import { NextFunction, Request, RequestHandler, Response, Router } from "express";
import { orderAccessTokenParamSchema, trackOrderSchema } from "@repo/zod-schema/index";
import { ApiResponse, asyncHandler } from "../utils/api";
import { orderRateLimiter } from "../middlewares/orderRateLimiter.middleware";
import { documentRateLimiter } from "../middlewares/documentRateLimiter.middleware";
import { returnRateLimiter } from "../middlewares/returnRateLimiter.middleware";
import {
  cancelOrderController,
  getOrderByIdController,
  getOrderInvoiceController,
  getOrderReceiptController,
} from "../controllers/orders.controllers";
import { trackOrderController } from "../controllers/payment.controllers";
import {
  cancelReturnController,
  createReturnController,
  getOrderReturnsController,
  quoteReturnController,
  returnUploadSignatureController,
} from "../controllers/returns.controllers";
import { resolveOrderAccessTokenService, trackOrderByReferenceService } from "../services/orderAccess.services";

// ── Public tracking: order number + email/phone ─────────────────────────────

export const publicOrdersRouter: Router = Router();

publicOrdersRouter.post(
  "/track",
  orderRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const input = trackOrderSchema.parse(req.body);
    const result = await trackOrderByReferenceService(input);
    return new ApiResponse(200, result, "Tracking info fetched").send(res);
  })
);

// ── Private "View your order" link: /orders/view/:token/... ─────────────────

/**
 * The emailed link stands in for a sign-in, but for exactly one order: the request runs as
 * the order's customer in a guest session narrowed to that order (see guestScope), and the
 * existing order and return controllers do the rest unchanged.
 */
async function orderAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = orderAccessTokenParamSchema.parse(req.params);
    const { orderId, userId } = await resolveOrderAccessTokenService(token);
    req.user = { userId, role: "USER", guest: { since: new Date(), orderId } };
    res.locals.orderId = orderId;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Hands the resolved order id to a controller that reads it from `req.params.id`. The link
 * token is dropped: the controllers' param schemas are strict and would reject the extra key.
 */
const forOrder =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    const { token: _token, ...rest } = req.params;
    req.params = { ...rest, id: res.locals.orderId };
    return handler(req, res, next);
  };

export const orderAccessRouter: Router = Router({ mergeParams: true });

orderAccessRouter.use(orderAccess);
orderAccessRouter.get("/", orderRateLimiter, forOrder(getOrderByIdController));
orderAccessRouter.get("/invoice", documentRateLimiter, forOrder(getOrderInvoiceController));
orderAccessRouter.get("/receipt", documentRateLimiter, forOrder(getOrderReceiptController));
orderAccessRouter.get("/track", forOrder(trackOrderController));
orderAccessRouter.post("/cancel", orderRateLimiter, forOrder(cancelOrderController));
orderAccessRouter.get("/returns", returnRateLimiter, forOrder(getOrderReturnsController));
orderAccessRouter.post("/returns/quote", returnRateLimiter, forOrder(quoteReturnController));
orderAccessRouter.post("/returns/upload-signature", returnRateLimiter, forOrder(returnUploadSignatureController));
orderAccessRouter.post("/returns", returnRateLimiter, forOrder(createReturnController));
orderAccessRouter.post("/returns/:returnId/cancel", returnRateLimiter, forOrder(cancelReturnController));
