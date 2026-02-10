// src/controllers/review.controllers.ts
import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  createReviewService,
  getProductReviewsService,
} from "../services/review.services";
import { createReviewSchema } from "@repo/zod-schema/index";
import { uuidSchema } from "@repo/zod-schema/index"; 

async function createReview(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  
  const validated = createReviewSchema.parse(req.body);
  const review = await createReviewService(userId, validated);
  return new ApiResponse(201, review, "Review created").send(res);
}

async function getProductReviews(req: Request, res: Response) {
  const productId = uuidSchema.parse(req.params.productId);
  const { page = 1, limit = 20 } = req.query;
  const parsedPage = Number(page);
  const parsedLimit = Math.min(Number(limit), 100);
  
  if (isNaN(parsedPage) || isNaN(parsedLimit)) {
    throw new ApiError(400, "Invalid pagination parameters");
  }
  
  const result = await getProductReviewsService(productId, parsedPage, parsedLimit);
  return new ApiResponse(200, result, "Reviews fetched").send(res);
}

export const createReviewController = asyncHandler(createReview);
export const getProductReviewsController = asyncHandler(getProductReviews);