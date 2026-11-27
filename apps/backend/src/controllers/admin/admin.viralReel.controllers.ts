import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import { viralReelSchema, viralReelParamSchema } from "@repo/zod-schema/index";
import {
  adminListViralReelsService,
  adminCreateViralReelService,
  adminUpdateViralReelService,
  adminToggleViralReelService,
  adminDeleteViralReelService,
} from "../../services/admin/admin.viralReel.services";

function requireAdminId(req: Request) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");
  return adminUserId;
}

async function listReels(_req: Request, res: Response) {
  const result = await adminListViralReelsService();
  return new ApiResponse(200, result, "Reels fetched").send(res);
}

async function createReel(req: Request, res: Response) {
  const adminUserId = requireAdminId(req);
  const data = viralReelSchema.parse(req.body);
  const result = await adminCreateViralReelService(adminUserId, data);
  return new ApiResponse(201, result, "Reel added").send(res);
}

async function updateReel(req: Request, res: Response) {
  const adminUserId = requireAdminId(req);
  const { id } = viralReelParamSchema.parse(req.params);
  const data = viralReelSchema.parse(req.body);
  const result = await adminUpdateViralReelService(adminUserId, id, data);
  return new ApiResponse(200, result, "Reel updated").send(res);
}

async function toggleReel(req: Request, res: Response) {
  const adminUserId = requireAdminId(req);
  const { id } = viralReelParamSchema.parse(req.params);
  const result = await adminToggleViralReelService(adminUserId, id);
  return new ApiResponse(200, result, result.isActive ? "Reel shown" : "Reel hidden").send(res);
}

async function deleteReel(req: Request, res: Response) {
  const adminUserId = requireAdminId(req);
  const { id } = viralReelParamSchema.parse(req.params);
  const result = await adminDeleteViralReelService(adminUserId, id);
  return new ApiResponse(200, result, "Reel deleted").send(res);
}

export const adminListViralReelsController  = asyncHandler(listReels);
export const adminCreateViralReelController = asyncHandler(createReel);
export const adminUpdateViralReelController = asyncHandler(updateReel);
export const adminToggleViralReelController = asyncHandler(toggleReel);
export const adminDeleteViralReelController = asyncHandler(deleteReel);
