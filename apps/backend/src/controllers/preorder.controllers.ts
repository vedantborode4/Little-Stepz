import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  createPreOrderSchema,
  verifyPreOrderPaymentSchema,
  preOrderParamsSchema,
  balanceTokenParamsSchema,
} from "@repo/zod-schema/index";
import {
  createPreOrderService,
  verifyBookingPaymentService,
  getMyPreOrdersService,
  getPreOrderByIdService,
  getPreOrderByTokenService,
  createBalancePaymentService,
  verifyBalancePaymentService,
} from "../services/preorder.services";

export const createPreOrderController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey) throw new ApiError(400, "Idempotency-Key header is required");

  const data = createPreOrderSchema.parse(req.body);
  const result = await createPreOrderService(userId, data, idempotencyKey);
  return new ApiResponse(201, result, "Pre-order created").send(res);
});

export const verifyBookingController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { id } = preOrderParamsSchema.parse(req.params);
  const data = verifyPreOrderPaymentSchema.parse(req.body);
  const result = await verifyBookingPaymentService(userId, id, data);
  return new ApiResponse(200, result, "Booking confirmed").send(res);
});

export const getMyPreOrdersController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const result = await getMyPreOrdersService(userId);
  return new ApiResponse(200, result, "Pre-orders fetched").send(res);
});

export const getPreOrderByIdController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const { id } = preOrderParamsSchema.parse(req.params);
  const result = await getPreOrderByIdService(userId, id);
  return new ApiResponse(200, result, "Pre-order fetched").send(res);
});

/* ── Public, token-gated balance endpoints ── */

export const getPreOrderByTokenController = asyncHandler(async (req: Request, res: Response) => {
  const { token } = balanceTokenParamsSchema.parse(req.params);
  const result = await getPreOrderByTokenService(token);
  return new ApiResponse(200, result, "Pre-order fetched").send(res);
});

export const createBalancePaymentController = asyncHandler(async (req: Request, res: Response) => {
  const { token } = balanceTokenParamsSchema.parse(req.params);
  const result = await createBalancePaymentService(token);
  return new ApiResponse(200, result, "Balance payment initiated").send(res);
});

export const verifyBalancePaymentController = asyncHandler(async (req: Request, res: Response) => {
  const { token } = balanceTokenParamsSchema.parse(req.params);
  const data = verifyPreOrderPaymentSchema.parse(req.body);
  const result = await verifyBalancePaymentService(token, data);
  return new ApiResponse(200, result, "Balance payment confirmed").send(res);
});
