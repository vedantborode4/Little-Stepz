import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  getWarehouseStatusService,
  registerWarehouseService,
} from "../../services/admin/admin.shipping.services";

async function getWarehouseStatus(_req: Request, res: Response) {
  const result = await getWarehouseStatusService();
  return new ApiResponse(200, result, result.message).send(res);
}

async function registerWarehouse(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const result = await registerWarehouseService();

  return new ApiResponse(
    result.created ? 201 : 200,
    result,
    result.created
      ? "Pickup warehouse registered with Delhivery"
      : "Pickup warehouse was already registered"
  ).send(res);
}

export const getWarehouseStatusController = asyncHandler(getWarehouseStatus);
export const registerWarehouseController = asyncHandler(registerWarehouse);
