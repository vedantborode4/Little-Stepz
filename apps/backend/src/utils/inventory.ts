import { Prisma } from "@repo/db/client";

/**
 * Single source of truth for a product's availability, replacing the copies that
 * previously drifted across the variant/product services.
 *
 * - Product WITH active variants → in stock when any active variant has stock.
 * - Product WITHOUT variants (simple) → in stock when its own quantity > 0.
 */
export async function deriveInStock(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<boolean> {
  const activeVariants = await tx.variant.count({
    where: { productId, deletedAt: null },
  });

  if (activeVariants > 0) {
    const stocked = await tx.variant.count({
      where: { productId, deletedAt: null, stock: { gt: 0 } },
    });
    return stocked > 0;
  }

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { quantity: true },
  });
  return (product?.quantity ?? 0) > 0;
}

/**
 * Recomputes and persists `Product.inStock`, writing only when it actually
 * changes. Returns the derived value.
 */
export async function syncProductInStock(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<boolean> {
  const hasStock = await deriveInStock(tx, productId);
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { inStock: true },
  });
  if (product && product.inStock !== hasStock) {
    await tx.product.update({
      where: { id: productId },
      data: { inStock: hasStock },
    });
  }
  return hasStock;
}
