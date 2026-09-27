import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  orderParamsSchema,
  returnRefundParamsSchema,
  adminReturnsQuerySchema,
  scheduleReturnPickupBodySchema,
  receiveReturnBodySchema,
  settleReturnRefundBodySchema,
  retryReturnRefundBodySchema,
} from "@repo/zod-schema/index";
import {
  listReturnsService,
  getReturnDetailService,
  scheduleReturnPickupService,
  markReturnPickedUpService,
  receiveReturnService,
  settleReturnRefundService,
  retryReturnRefundService,
} from "../../services/returns.services";

function requireAdmin(req: Request): string {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");
  return adminUserId;
}

async function listReturns(req: Request, res: Response) {
  const query = adminReturnsQuerySchema.parse(req.query);
  return new ApiResponse(200, await listReturnsService(query), "Returns fetched").send(res);
}

async function getReturn(req: Request, res: Response) {
  const { id } = orderParamsSchema.parse(req.params);
  return new ApiResponse(200, await getReturnDetailService(id), "Return fetched").send(res);
}

async function schedulePickup(req: Request, res: Response) {
  const adminUserId = requireAdmin(req);
  const { id } = orderParamsSchema.parse(req.params);
  const { mode } = scheduleReturnPickupBodySchema.parse(req.body);
  return new ApiResponse(200, await scheduleReturnPickupService(adminUserId, id, mode, req), "Pickup scheduled").send(res);
}

async function markPickedUp(req: Request, res: Response) {
  const adminUserId = requireAdmin(req);
  const { id } = orderParamsSchema.parse(req.params);
  return new ApiResponse(200, await markReturnPickedUpService(adminUserId, id, req), "Marked picked up").send(res);
}

async function receive(req: Request, res: Response) {
  const adminUserId = requireAdmin(req);
  const { id } = orderParamsSchema.parse(req.params);
  const body = receiveReturnBodySchema.parse(req.body);
  return new ApiResponse(200, await receiveReturnService(adminUserId, id, body, req), "Return received").send(res);
}

async function settleRefund(req: Request, res: Response) {
  const adminUserId = requireAdmin(req);
  const { id } = returnRefundParamsSchema.parse(req.params);
  const { reference } = settleReturnRefundBodySchema.parse(req.body);
  return new ApiResponse(200, await settleReturnRefundService(adminUserId, id, reference, req), "Refund settled").send(res);
}

async function retryRefund(req: Request, res: Response) {
  const adminUserId = requireAdmin(req);
  const { id } = returnRefundParamsSchema.parse(req.params);
  retryReturnRefundBodySchema.parse(req.body);
  return new ApiResponse(200, await retryReturnRefundService(adminUserId, id, req), "Refund retried").send(res);
}

export const listReturnsController     = asyncHandler(listReturns);
export const getReturnController       = asyncHandler(getReturn);
export const scheduleReturnPickupController = asyncHandler(schedulePickup);
export const markReturnPickedUpController   = asyncHandler(markPickedUp);
export const receiveReturnController   = asyncHandler(receive);
export const settleReturnRefundController   = asyncHandler(settleRefund);
export const retryReturnRefundController    = asyncHandler(retryRefund);
