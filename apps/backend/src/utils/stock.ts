import { Prisma } from "@repo/db/client";

/**
 * Keep `Product.inStock` in step with the stock that actually exists.
 *
 * `inStock` is a denormalized boolean, separate from `quantity` (and from each
 * variant's `stock`). Admin create/update set it, but the order and pre-order
 * flows only ever decremented the numbers — so a product sold down to zero kept
 * `inStock: true` and went on advertising itself as available, while filters and
 * badges built on the flag reported the wrong thing.
 *
 * Call this inside the same transaction as any stock movement, after the
 * increment/decrement has been applied.
 *
 * Availability matches the rule used elsewhere in the storefront: a product with
 * variants is in stock when ANY active variant has stock; a product without
 * variants is in stock when its own quantity is above zero.
 */
export async function syncProductStockFlag(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      quantity: true,
      inStock: true,
      variants: { where: { deletedAt: null }, select: { stock: true } },
    },
  });
  if (!product) return;

  const inStock =
    product.variants.length > 0
      ? product.variants.some((v) => v.stock > 0)
      : product.quantity > 0;

  // Only write when it actually changed — these run inside hot order transactions.
  if (product.inStock === inStock) return;

  await tx.product.update({ where: { id: productId }, data: { inStock } });
}

/** Same, for a set of products touched by one transaction (deduped). */
export async function syncProductStockFlags(
  tx: Prisma.TransactionClient,
  productIds: string[]
): Promise<void> {
  for (const id of Array.from(new Set(productIds))) {
    await syncProductStockFlag(tx, id);
  }
}
