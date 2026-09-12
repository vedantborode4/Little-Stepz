import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import { adminReviewsQuerySchema, deleteReviewSchema } from "@repo/zod-schema/index";
import { deleteReviewService, getAdminReviewsService } from "../../services/admin/admin.review.services";

async function getAdminReviews(req: Request, res: Response) {
  const { page, limit, productId } = adminReviewsQuerySchema.parse(req.query);
  const result = await getAdminReviewsService(page, limit, productId);
  return new ApiResponse(200, result, "Reviews fetched").send(res);
}

async function deleteReview(req: Request, res: Response) {
  // The route parameter is `:reviewId`. Reading `req.params.id` made it always undefined,
  // so every delete failed validation before reaching the service.
  const { reviewId } = deleteReviewSchema.parse({ reviewId: req.params.reviewId });
  await deleteReviewService(reviewId);
  return new ApiResponse(200, null, "Review deleted").send(res);
}

export const getAdminReviewsController = asyncHandler(getAdminReviews);
export const deleteReviewController = asyncHandler(deleteReview);