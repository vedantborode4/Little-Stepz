import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";

export async function deleteReviewService(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review || review.deletedAt) throw new ApiError(404, "Review not found");

  await prisma.review.update({
    where: { id: reviewId },
    data: { deletedAt: new Date(), isApproved: false },
  });
}