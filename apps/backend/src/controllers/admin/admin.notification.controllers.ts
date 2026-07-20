import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import { adminBroadcastService } from "../../services/admin/admin.notification.services";
import { adminBroadcastBodySchema } from "@repo/zod-schema/index";

async function broadcast(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");
  const body = adminBroadcastBodySchema.parse(req.body);
  const result = await adminBroadcastService(adminId, body);
  return new ApiResponse(201, result, "Notification broadcast sent").send(res);
}

export const adminBroadcastController = asyncHandler(broadcast);
