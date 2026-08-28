import { Decimal } from "decimal.js";
import type { prisma } from "@repo/db/client";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Pre-order terms resolved from a product and (optionally) the chosen variant.
 *
 * The product-level switch is the master: a variant can only opt OUT. That keeps
 * one obvious place to disable pre-orders entirely, and means every existing
 * variant (which defaults to `preOrderEnabled: true`) behaves exactly as before.
 *
 * The booking amount follows the same rule as `price`: a variant value overrides,
 * null inherits the product's.
 *
 * Caps are enforced at BOTH levels rather than one. The product cap is the total
 * across every variant ("200 units of this product"), while a variant cap bounds
 * that one variant. Checking only the variant would let the product total be
 * exceeded; checking only the product would ignore the per-variant limit.
 */

export interface PreOrderProductTerms {
  preOrderEnabled: boolean;
  bookingAmount: unknown;
  preOrderLimit: number | null;
  preOrderCount: number;
}

export interface PreOrderVariantTerms {
  id: string;
  preOrderEnabled: boolean;
  bookingAmount: unknown;
  preOrderLimit: number | null;
  preOrderCount: number;
}

export interface ResolvedPreOrderTerms {
  /** Whether this exact product/variant pairing can be pre-ordered at all. */
  enabled: boolean;
  /** Null when neither level defines one — the caller must reject the booking. */
  bookingAmount: Decimal | null;
  /** Whether the variant, rather than the product, supplied the amount. */
  bookingFromVariant: boolean;
}

export function resolvePreOrderTerms(
  product: PreOrderProductTerms,
  variant?: PreOrderVariantTerms | null
): ResolvedPreOrderTerms {
  const enabled = product.preOrderEnabled && (variant ? variant.preOrderEnabled : true);

  const raw = variant?.bookingAmount ?? product.bookingAmount;
  const bookingAmount = raw == null ? null : new Decimal(raw.toString());

  return {
    enabled,
    bookingAmount,
    bookingFromVariant: variant?.bookingAmount != null,
  };
}

/** True when taking `quantity` more would breach either cap. */
export function wouldExceedCap(
  product: PreOrderProductTerms,
  variant: PreOrderVariantTerms | null | undefined,
  quantity: number
): boolean {
  if (product.preOrderLimit != null && product.preOrderCount + quantity > product.preOrderLimit) {
    return true;
  }
  if (variant?.preOrderLimit != null && variant.preOrderCount + quantity > variant.preOrderLimit) {
    return true;
  }
  return false;
}

/**
 * Give back the slots a pre-order was holding, on both counters.
 *
 * Every release path (customer cancel, admin cancel, refund, balance completion,
 * expiry, the sweeper) has to decrement the variant counter as well as the
 * product's, or a variant cap would fill up permanently after the first few
 * abandoned bookings. Centralised here so a new release path cannot forget one.
 *
 * `gte` guards the decrement: a double release would otherwise drive the counter
 * negative and hand out capacity that does not exist.
 */
export async function releasePreOrderSlots(
  tx: Tx,
  entries: { productId: string; variantId: string | null; quantity: number }[]
): Promise<void> {
  if (!entries.length) return;

  const byProduct = new Map<string, number>();
  const byVariant = new Map<string, number>();

  for (const e of entries) {
    byProduct.set(e.productId, (byProduct.get(e.productId) ?? 0) + e.quantity);
    if (e.variantId) {
      byVariant.set(e.variantId, (byVariant.get(e.variantId) ?? 0) + e.quantity);
    }
  }

  for (const [productId, quantity] of byProduct) {
    await tx.product.updateMany({
      where: { id: productId, preOrderCount: { gte: quantity } },
      data: { preOrderCount: { decrement: quantity } },
    });
  }

  for (const [variantId, quantity] of byVariant) {
    await tx.variant.updateMany({
      where: { id: variantId, preOrderCount: { gte: quantity } },
      data: { preOrderCount: { decrement: quantity } },
    });
  }
}

/**
 * Reserve slots on both counters, atomically.
 *
 * The WHERE clause carries the cap so a concurrent booking cannot slip past a
 * check-then-write gap; `updateMany` returning 0 rows means the cap was hit.
 * Returns false instead of throwing so the caller owns the error code.
 */
export async function reservePreOrderSlots(
  tx: Tx,
  args: {
    productId: string;
    productLimit: number | null;
    variantId?: string | null;
    variantLimit?: number | null;
    quantity: number;
  }
): Promise<boolean> {
  const { productId, productLimit, variantId, variantLimit, quantity } = args;

  if (productLimit != null) {
    const upd = await tx.product.updateMany({
      where: { id: productId, preOrderCount: { lte: productLimit - quantity } },
      data: { preOrderCount: { increment: quantity } },
    });
    if (upd.count === 0) return false;
  } else {
    await tx.product.update({
      where: { id: productId },
      data: { preOrderCount: { increment: quantity } },
    });
  }

  if (!variantId) return true;

  if (variantLimit != null) {
    const upd = await tx.variant.updateMany({
      where: { id: variantId, preOrderCount: { lte: variantLimit - quantity } },
      data: { preOrderCount: { increment: quantity } },
    });
    if (upd.count === 0) {
      // The product counter was already incremented above. Roll it back here rather
      // than relying on the caller to throw — the transaction does unwind, but a
      // future caller that catches this could otherwise leak a product slot.
      await tx.product.updateMany({
        where: { id: productId, preOrderCount: { gte: quantity } },
        data: { preOrderCount: { decrement: quantity } },
      });
      return false;
    }
  } else {
    await tx.variant.update({
      where: { id: variantId },
      data: { preOrderCount: { increment: quantity } },
    });
  }

  return true;
}
