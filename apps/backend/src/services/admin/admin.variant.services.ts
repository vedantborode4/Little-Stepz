import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";


const normalizeVariantName = (name: string) =>
  name.trim().toLowerCase();

type CreateVariantInput = {
  productId: string;
  name: string;
  price?: number;
  stock?: number;
};

export async function createVariantService(data: CreateVariantInput) {
  const { productId, name, price, stock = 0 } = data;
  const normalizedName = normalizeVariantName(name);

  if (normalizedName.length < 1 || normalizedName.length > 200) {
    throw new ApiError(400, "Variant name must be 1-200 characters");
  }
  if (price !== undefined && price < 0) {
    throw new ApiError(400, "Price cannot be negative");
  }
  if (stock < 0) {
    throw new ApiError(400, "Stock cannot be negative");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, inStock: true },
    });
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const existingVariant = await tx.variant.findFirst({
      where: {
        productId,
        name: normalizedName,
      },
      select: { id: true },
    });
    if (existingVariant) {
      throw new ApiError(
        409,
        `Variant '${name.trim()}' already exists for this product`
      );
    }

    const variant = await tx.variant.create({
      data: {
        productId,
        name: normalizedName,
        price: price ?? null,
        stock,
      },
    });

    const hasStock =
      (await tx.variant.count({
        where: {
          productId,
          stock: { gt: 0 },
          deletedAt: null,
        },
      })) > 0;
    if (hasStock !== product.inStock) {
      await tx.product.update({
        where: { id: productId },
        data: { inStock: hasStock },
      });
    }

    return variant;
  });
}

type UpdateVariantInput = Partial<{
  name: string;
  price: number | null;
  stock: number;
}>;

export async function updateVariantService(
  variantId: string,
  data: UpdateVariantInput
) {
  const { name, price, stock } = data;

  if (name === undefined && price === undefined && stock === undefined) {
    throw new ApiError(400, "No fields provided to update");
  }

  if (
    name !== undefined &&
    (name.trim().length < 1 || name.trim().length > 200)
  ) {
    throw new ApiError(400, "Variant name must be 1-200 characters");
  }
  if (price !== undefined && price !== null && price < 0) {
    throw new ApiError(400, "Price cannot be negative");
  }
  if (stock !== undefined && stock < 0) {
    throw new ApiError(400, "Stock cannot be negative");
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
      },
    });
    if (!variant) {
      throw new ApiError(404, "Variant not found");
    }

    if (name !== undefined) {
      const normalizedName = normalizeVariantName(name);
      const existingVariant = await tx.variant.findFirst({
        where: {
          productId: variant.productId,
          name: normalizedName,
          NOT: { id: variantId },
        },
        select: { id: true },
      });
      if (existingVariant) {
        throw new ApiError(
          409,
          `Variant '${name.trim()}' already exists for this product`
        );
      }
    }

    const updated = await tx.variant.update({
      where: { id: variantId },
      data: {
        name: name !== undefined ? normalizeVariantName(name) : undefined,
        price: price !== undefined ? price : undefined,
        stock: stock !== undefined ? stock : undefined,
      },
      select: {
        id: true,
        productId: true,
      },
    });

    const hasStock =
      (await tx.variant.count({
        where: {
          productId: updated.productId,
          stock: { gt: 0 },
          deletedAt: null,
        },
      })) > 0;
    const product = await tx.product.findUnique({
      where: { id: updated.productId },
      select: { inStock: true },
    });
    if (product && hasStock !== product.inStock) {
      await tx.product.update({
        where: { id: updated.productId },
        data: { inStock: hasStock },
      });
    }

    return updated;
  });
}

export async function deleteVariantService(variantId: string) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
      },
    });
    if (!variant) {
      throw new ApiError(404, "Variant not found");
    }

    await tx.variant.update({
      where: { id: variantId },
      data: { deletedAt: new Date() },
    });

    const hasStock =
      (await tx.variant.count({
        where: {
          productId: variant.productId,
          stock: { gt: 0 },
          deletedAt: null,
        },
      })) > 0;
    const product = await tx.product.findUnique({
      where: { id: variant.productId },
      select: { inStock: true },
    });
    if (product && !hasStock && product.inStock) {
      await tx.product.update({
        where: { id: variant.productId },
        data: { inStock: false },
      });
    }
  });
}
