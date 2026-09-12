import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";

/**
 * Every live review, newest first, optionally narrowed to one product.
 *
 * Both admin panels called this endpoint and, finding no route, fell back to stitching
 * reviews together from the first 50 products' public review pages — so the list was
 * silently incomplete for any catalogue past that size.
 */
export async function getAdminReviewsService(page: number, limit: number, productId?: string) {
  const where = { deletedAt: null, ...(productId ? { productId } : {}) };

  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              where: { variantId: null, deletedAt: null },
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

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