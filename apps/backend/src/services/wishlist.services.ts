import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";

const wishlistItemSelect = {
  id: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      images: { take: 1, select: { url: true } },
    },
  },
  createdAt: true,
} as const;

export async function getWishlistService(userId: string) {
  const items = await prisma.wishlistItem.findMany({
    where: {
      userId,
      deletedAt: null,
      product: { deletedAt: null },
    },
    select: wishlistItemSelect,
    orderBy: { createdAt: "desc" },
  });

  return { items };
}

export async function addToWishlistService(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });

  if (!product) throw new ApiError(404, "Product not found");

  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (existing && !existing.deletedAt) {
    throw new ApiError(409, "Product already in wishlist");
  }

  const item = await prisma.wishlistItem.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    create: {
      userId,
      productId,
    },
    update: {
      deletedAt: null,
    },
    select: wishlistItemSelect,
  });

  return item;
}

export async function removeFromWishlistService(userId: string, productId: string) {
  const item = await prisma.wishlistItem.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (!item || item.deletedAt) throw new ApiError(404, "Item not found in wishlist");

  await prisma.wishlistItem.update({
    where: { id: item.id },
    data: { deletedAt: new Date() },
  });
}