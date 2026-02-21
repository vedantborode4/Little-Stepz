import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  resolveReturnBodySchema,
} from "@repo/zod-schema/index";

import { orderParamsSchema } from "@repo/zod-schema/index";
import { createShipmentService, resolveReturnService } from "../../services/admin/admin.payment.services";



async function resolveReturn(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: returnId } = orderParamsSchema.parse(req.params);
  const validated        = resolveReturnBodySchema.parse(req.body);
  const result           = await resolveReturnService(adminUserId, returnId, validated, req);

  return new ApiResponse(200, result, "Return resolved").send(res);
}


async function createShipment(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: orderId } = orderParamsSchema.parse(req.params);
  const result          = await createShipmentService(adminUserId, orderId, req);

  return new ApiResponse(201, result, "Shipment created").send(res);
}

export const resolveReturnController    = asyncHandler(resolveReturn);
export const createShipmentController   = asyncHandler(createShipment);
