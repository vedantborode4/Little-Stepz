import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../utils/api";
import { getActiveViralReelsService } from "../services/viralReel.services";

async function getViralReels(_req: Request, res: Response) {
  const result = await getActiveViralReelsService();
  return new ApiResponse(200, result, "Reels fetched").send(res);
}

export const getViralReelsController = asyncHandler(getViralReels);
