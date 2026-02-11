import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import { calculateCheckoutService } from "../services/checkout.services";
import { checkoutCalculateBodySchema } from "@repo/zod-schema/index";

async function calculateCheckout(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const validated = checkoutCalculateBodySchema.parse(req.body);

  const result = await calculateCheckoutService(userId, validated);

  return new ApiResponse(200, result, "Checkout calculated").send(res);
}

export const calculateCheckoutController = asyncHandler(calculateCheckout);