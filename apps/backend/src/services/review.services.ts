// src/services/review.services.ts
import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import type { CreateReviewData } from "@repo/zod-schema/index"; // Assuming type export location

const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const;

export async function createReviewService(userId: string, data: CreateReviewData) {
  const { productId, orderId, rating, comment } = data;

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });

  if (!product) throw new ApiError(404, "Product not found");

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: "DELIVERED", // Assuming only delivered orders can be reviewed
      },
    });
    if (!order) throw new ApiError(400, "Invalid order for review");
  }

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) throw new ApiError(409, "You have already reviewed this product");

  const review = await prisma.review.create({
    data: {
      userId,
      productId,
      orderId,
      rating,
      comment,
      isApproved: true, // Default, admin can moderate
    },
    select: reviewSelect,
  });

  return review;
}

export async function getProductReviewsService(productId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const where = {
    productId,
    deletedAt: null,
    isApproved: true,
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: reviewSelect,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}