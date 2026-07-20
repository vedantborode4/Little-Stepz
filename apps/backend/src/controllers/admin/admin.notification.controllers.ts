import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  adminBroadcastService,
  listBroadcastsService,
  searchBroadcastTargetsService,
  type TargetSearchKind,
} from "../../services/admin/admin.notification.services";
import { adminBroadcastBodySchema } from "@repo/zod-schema/index";

async function broadcast(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");
  const body = adminBroadcastBodySchema.parse(req.body);
  const result = await adminBroadcastService(adminId, body);
  return new ApiResponse(201, result, "Notification broadcast sent").send(res);
}

async function listBroadcasts(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const result = await listBroadcastsService(page, limit);
  return new ApiResponse(200, result, "Broadcasts fetched").send(res);
}

async function searchTargets(req: Request, res: Response) {
  const kind = String(req.query.kind || "") as TargetSearchKind;
  if (!["user", "product", "order"].includes(kind)) {
    throw new ApiError(400, "Invalid search kind");
  }
  const q = String(req.query.q || "");
  const results = await searchBroadcastTargetsService(kind, q);
  return new ApiResponse(200, { results }, "Search results").send(res);
}

export const adminBroadcastController = asyncHandler(broadcast);
export const adminListBroadcastsController = asyncHandler(listBroadcasts);
export const adminSearchTargetsController = asyncHandler(searchTargets);
