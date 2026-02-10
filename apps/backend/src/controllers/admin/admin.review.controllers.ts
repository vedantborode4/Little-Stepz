import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import { deleteReviewSchema } from "@repo/zod-schema/index";
import { deleteReviewService } from "../../services/admin/admin.review.services";

async function deleteReview(req: Request, res: Response) {
  const { reviewId } = deleteReviewSchema.parse({ reviewId: req.params.id });
  await deleteReviewService(reviewId);
  return new ApiResponse(200, null, "Review deleted").send(res);
}

export const deleteReviewController = asyncHandler(deleteReview);