// src/services/admin/admin.product.image.services.ts
import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { cloudinary } from "../../utils/cloudinary";

type AddImageInput = {
  url: string;
  alt?: string;
  sortOrder?: number;
  publicId: string;
};

export async function addProductImageService(
  productId: string,
  data: AddImageInput
) {
  return prisma.$transaction(async (tx) => {

    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const imageCount = await tx.productImage.count({
      where: { productId, deletedAt: null },
    });

    if (imageCount >= 8) {
      throw new ApiError(400, "Maximum 8 images allowed per product");
    }

    const lastOrder = await tx.productImage.findFirst({
      where: {
        productId,
        deletedAt: null,
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const sortOrder =
      data.sortOrder ?? (lastOrder?.sortOrder ?? -1) + 1;

    const image = await tx.productImage.create({
      data: {
        productId,
        url: data.url,
        publicId: data.publicId,
        alt: data.alt,
        sortOrder,
      },
      select: {
        id: true,
        url: true,
        alt: true,
        sortOrder: true,
      },
    });

    return image;
  });
}

export async function reorderProductImageService(
  imageId: string,
  newOrder: number
) {
  return prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findFirst({
      where: { id: imageId, deletedAt: null },
      select: { id: true, productId: true, sortOrder: true },
    });

    if (!image) {
      throw new ApiError(404, "Image not found");
    }

    if (image.sortOrder === newOrder) {
      return image;
    }

    const direction =
      newOrder > image.sortOrder ? "down" : "up";

    if (direction === "down") {
      await tx.productImage.updateMany({
        where: {
          productId: image.productId,
          deletedAt: null,
          sortOrder: {
            gt: image.sortOrder,
            lte: newOrder,
          },
        },
        data: { sortOrder: { decrement: 1 } },
      });
    } else {
      await tx.productImage.updateMany({
        where: {
          productId: image.productId,
          deletedAt: null,
          sortOrder: {
            gte: newOrder,
            lt: image.sortOrder,
          },
        },
        data: { sortOrder: { increment: 1 } },
      });
    }

    const updated = await tx.productImage.update({
      where: { id: imageId },
      data: { sortOrder: newOrder },
      select: {
        id: true,
        url: true,
        alt: true,
        sortOrder: true,
      },
    });

    return updated;
  });
}

export async function deleteProductImageService(imageId: string) {
  let publicId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findFirst({
      where: { id: imageId, deletedAt: null },
      select: { id: true, productId: true, sortOrder: true, publicId: true },
    });

    if (!image) {
      throw new ApiError(404, "Image not found");
    }

    publicId = image.publicId;

    await tx.productImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });

    await tx.productImage.updateMany({
      where: {
        productId: image.productId,
        deletedAt: null,
        sortOrder: { gt: image.sortOrder },
      },
      data: { sortOrder: { decrement: 1 } },
    });
  });

  if (publicId) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
}

export async function replaceProductImageService(
  imageId: string,
  data: { url: string; publicId: string; alt?: string }
) {
  let oldPublicId: string;

  const updated = await prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findFirst({
      where: { id: imageId, deletedAt: null },
    });

    if (!image) throw new ApiError(404, "Image not found");

    oldPublicId = image.publicId;

    return tx.productImage.update({
      where: { id: imageId },
      data: {
        url: data.url,
        publicId: data.publicId,
        alt: data.alt,
      },
      select: {
        id: true,
        url: true,
        alt: true,
        sortOrder: true,
      },
    });
  });

  await cloudinary.uploader.destroy(oldPublicId!).catch(() => {});

  return updated;
}
