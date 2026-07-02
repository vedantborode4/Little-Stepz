import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { notifyRestockedPreOrders } from "../preorder.services";


type CreateVariantInput = {
  productId: string;
  name: string;
  price?: number;
  salePrice?: number;
  isOnSale?: boolean;
  stock?: number;
};

export async function createVariantService(data: CreateVariantInput) {
  const { productId, name, price, salePrice, isOnSale = false, stock = 0 } = data;
  // Store the name exactly as the admin typed it (trimmed) — only the duplicate
  // check below is case-insensitive.
  const displayName = name.trim();

  if (displayName.length < 1 || displayName.length > 200) {
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
        name: { equals: displayName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingVariant) {
      throw new ApiError(
        409,
        `Variant '${displayName}' already exists for this product`
      );
    }

    const variant = await tx.variant.create({
      data: {
        productId,
        name: displayName,
        price: price ?? null,
        salePrice: salePrice ?? null,
        isOnSale,
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
  salePrice: number | null;
  isOnSale: boolean;
  stock: number;
}>;

export async function updateVariantService(
  variantId: string,
  data: UpdateVariantInput
) {
  const { name, price, salePrice, isOnSale, stock } = data;

  if (
    name === undefined &&
    price === undefined &&
    salePrice === undefined &&
    isOnSale === undefined &&
    stock === undefined
  ) {
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

  const { updated, restocked, productId } = await prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        stock: true,
      },
    });
    if (!variant) {
      throw new ApiError(404, "Variant not found");
    }

    if (name !== undefined) {
      const displayName = name.trim();
      const existingVariant = await tx.variant.findFirst({
        where: {
          productId: variant.productId,
          name: { equals: displayName, mode: "insensitive" },
          NOT: { id: variantId },
        },
        select: { id: true },
      });
      if (existingVariant) {
        throw new ApiError(
          409,
          `Variant '${displayName}' already exists for this product`
        );
      }
    }

    const updated = await tx.variant.update({
      where: { id: variantId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        price: price !== undefined ? price : undefined,
        salePrice: salePrice !== undefined ? salePrice : undefined,
        isOnSale: isOnSale !== undefined ? isOnSale : undefined,
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

    const newStock = stock !== undefined ? stock : variant.stock;
    const restocked = variant.stock <= 0 && newStock > 0;

    return { updated, restocked, productId: variant.productId };
  });

  // Restock event for this variant — notify variant-level pre-orders.
  if (restocked) {
    void notifyRestockedPreOrders(productId, variantId);
  }

  return updated;
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

    // Re-derive availability: if active variants remain, use their stock; if the
    // last variant was just removed, fall back to the product's own quantity so
    // it becomes a simple product again instead of being stranded out of stock.
    const remainingVariants = await tx.variant.count({
      where: { productId: variant.productId, deletedAt: null },
    });
    const product = await tx.product.findUnique({
      where: { id: variant.productId },
      select: { inStock: true, quantity: true },
    });

    let hasStock: boolean;
    if (remainingVariants > 0) {
      hasStock =
        (await tx.variant.count({
          where: { productId: variant.productId, stock: { gt: 0 }, deletedAt: null },
        })) > 0;
    } else {
      hasStock = (product?.quantity ?? 0) > 0;
    }

    if (product && hasStock !== product.inStock) {
      await tx.product.update({
        where: { id: variant.productId },
        data: { inStock: hasStock },
      });
    }
  });
}
