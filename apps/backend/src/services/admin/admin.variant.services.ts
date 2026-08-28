import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { notifyRestockedPreOrders } from "../preorder.services";
import { syncProductStockFlag } from "../../utils/stock";


type CreateVariantInput = {
  productId: string;
  name: string;
  sku?: string | null;
  sortOrder?: number;
  isDefault?: boolean;
  price?: number | null;
  salePrice?: number | null;
  isOnSale?: boolean;
  stock?: number;
  /** Per-variant pre-order terms; see utils/preOrderTerms.ts for the rules. */
  preOrderEnabled?: boolean;
  bookingAmount?: number | null;
  preOrderLimit?: number | null;
};

export async function createVariantService(data: CreateVariantInput) {
  const {
    productId, name, sku, sortOrder, isDefault = false, price, salePrice,
    isOnSale = false, stock = 0, preOrderEnabled, bookingAmount, preOrderLimit,
  } = data;
  // Store the name exactly as the admin typed it (trimmed) — only the duplicate
  // check below is case-insensitive.
  const displayName = name.trim();
  const cleanSku = sku?.trim() || null;

  if (displayName.length < 1 || displayName.length > 200) {
    throw new ApiError(400, "Variant name must be 1-200 characters");
  }
  if (price != null && price < 0) {
    throw new ApiError(400, "Price cannot be negative");
  }
  if (stock < 0) {
    throw new ApiError(400, "Stock cannot be negative");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
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

    if (cleanSku) {
      const skuTaken = await tx.variant.findUnique({ where: { sku: cleanSku }, select: { id: true } });
      if (skuTaken) throw new ApiError(409, `SKU '${cleanSku}' is already in use`);
    }

    // At most one default variant per product.
    if (isDefault) {
      await tx.variant.updateMany({
        where: { productId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const variant = await tx.variant.create({
      data: {
        productId,
        name: displayName,
        sku: cleanSku,
        sortOrder: sortOrder ?? 0,
        isDefault,
        price: price ?? null,
        salePrice: salePrice ?? null,
        isOnSale,
        stock,
        // Defaults to true (inherit the product's setting) when not supplied.
        preOrderEnabled: preOrderEnabled ?? true,
        bookingAmount: bookingAmount ?? null,
        preOrderLimit: preOrderLimit ?? null,
      },
    });

    await syncProductStockFlag(tx, productId);

    return variant;
  });
}

type UpdateVariantInput = Partial<{
  name: string;
  sku: string | null;
  sortOrder: number;
  isDefault: boolean;
  price: number | null;
  salePrice: number | null;
  isOnSale: boolean;
  stock: number;
  preOrderEnabled: boolean;
  bookingAmount: number | null;
  preOrderLimit: number | null;
}>;

export async function updateVariantService(
  variantId: string,
  data: UpdateVariantInput
) {
  const {
    name, sku, sortOrder, isDefault, price, salePrice, isOnSale, stock,
    preOrderEnabled, bookingAmount, preOrderLimit,
  } = data;

  if (
    name === undefined &&
    sku === undefined &&
    sortOrder === undefined &&
    isDefault === undefined &&
    price === undefined &&
    salePrice === undefined &&
    isOnSale === undefined &&
    stock === undefined &&
    preOrderEnabled === undefined &&
    bookingAmount === undefined &&
    preOrderLimit === undefined
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

  const cleanSku = sku === undefined ? undefined : sku?.trim() || null;

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

    if (cleanSku) {
      const skuTaken = await tx.variant.findFirst({
        where: { sku: cleanSku, NOT: { id: variantId } },
        select: { id: true },
      });
      if (skuTaken) throw new ApiError(409, `SKU '${cleanSku}' is already in use`);
    }

    // At most one default variant per product.
    if (isDefault) {
      await tx.variant.updateMany({
        where: { productId: variant.productId, deletedAt: null, isDefault: true, NOT: { id: variantId } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.variant.update({
      where: { id: variantId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        sku: cleanSku,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined,
        isDefault: isDefault !== undefined ? isDefault : undefined,
        price: price !== undefined ? price : undefined,
        salePrice: salePrice !== undefined ? salePrice : undefined,
        isOnSale: isOnSale !== undefined ? isOnSale : undefined,
        stock: stock !== undefined ? stock : undefined,
        preOrderEnabled: preOrderEnabled !== undefined ? preOrderEnabled : undefined,
        // null is meaningful here — it clears the override so the variant inherits
        // the product's amount again, so it must not be collapsed to "unchanged".
        bookingAmount: bookingAmount !== undefined ? bookingAmount : undefined,
        preOrderLimit: preOrderLimit !== undefined ? preOrderLimit : undefined,
      },
      select: {
        id: true,
        productId: true,
      },
    });

    await syncProductStockFlag(tx, updated.productId);

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

    // Re-derive availability via the shared helper: active variants remaining →
    // from their stock; last variant removed → falls back to product.quantity.
    await syncProductStockFlag(tx, variant.productId);
  });
}
