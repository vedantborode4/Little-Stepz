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

  const inStock = deriveInStockFrom(product);

  // Only write when it actually changed — these run inside hot order transactions.
  if (product.inStock === inStock) return;

  await tx.product.update({ where: { id: productId }, data: { inStock } });
}

/** The availability rule itself, in one place. */
function deriveInStockFrom(product: {
  quantity: number;
  variants: { stock: number }[];
}): boolean {
  return product.variants.length > 0
    ? product.variants.some((v) => v.stock > 0)
    : product.quantity > 0;
}

/**
 * Compute availability without writing it.
 *
 * Previously lived in a second module (`utils/inventory.ts`) with its own
 * count-based implementation of the same rule, used by the admin services while the
 * order services used this one. Two implementations of "is this in stock" is exactly
 * how the admin cancel path ended up leaving `inStock` false on a restocked product.
 */
export async function deriveInStock(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<boolean> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      quantity: true,
      variants: { where: { deletedAt: null }, select: { stock: true } },
    },
  });
  if (!product) return false;
  return deriveInStockFrom(product);
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

/**
 * Put an order's items back into sellable stock.
 *
 * Stock leaves at order creation, so every path that undoes an order has to put it
 * back the same way: abandoned checkouts, cancellations, RTO parcels and approved
 * returns. They used to each carry their own copy of this loop, which is how the
 * admin cancel path ended up restoring the numbers without resyncing `inStock`.
 *
 * Callers are responsible for deciding *whether* stock should come back — this
 * only performs the movement. Notably a cancelled-in-transit parcel must NOT call
 * this until it physically returns (the RTO webhook), or the units get sold twice.
 */
export async function restoreOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true, quantity: true },
  });

  for (const item of items) {
    if (item.variantId) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
  }

  // Returning stock can bring a sold-out product back in stock.
  await syncProductStockFlags(tx, items.map((i) => i.productId));
}
