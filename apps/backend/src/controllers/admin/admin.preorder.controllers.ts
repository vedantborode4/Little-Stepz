import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/api";
import { PreOrderStatus } from "@repo/db/client";
import { preOrderParamsSchema } from "@repo/zod-schema/index";
import {
  listPreOrdersService,
  getAdminPreOrderByIdService,
  refundBookingService,
  cancelPreOrderService,
  resendBalanceLinkService,
} from "../../services/admin/admin.preorder.services";

export const listPreOrdersController = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
  const status = statusRaw && statusRaw in PreOrderStatus ? (statusRaw as PreOrderStatus) : undefined;

  const result = await listPreOrdersService(page, limit, status);
  return new ApiResponse(200, result, "Pre-orders fetched").send(res);
});

export const getAdminPreOrderByIdController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = preOrderParamsSchema.parse(req.params);
  const result = await getAdminPreOrderByIdService(id);
  return new ApiResponse(200, result, "Pre-order fetched").send(res);
});

export const refundBookingController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = preOrderParamsSchema.parse(req.params);
  const result = await refundBookingService(id);
  return new ApiResponse(200, result, "Booking refunded").send(res);
});

export const cancelPreOrderController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = preOrderParamsSchema.parse(req.params);
  const result = await cancelPreOrderService(id);
  return new ApiResponse(200, result, "Pre-order cancelled").send(res);
});

export const resendBalanceLinkController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = preOrderParamsSchema.parse(req.params);
  const result = await resendBalanceLinkService(id);
  return new ApiResponse(200, result, "Balance link resent").send(res);
});
