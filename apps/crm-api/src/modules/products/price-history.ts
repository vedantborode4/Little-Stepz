import type { PriceField, Prisma, Tx } from "@repo/crm-db/client";

type Prices = { regularPrice: Prisma.Decimal; offerPrice: Prisma.Decimal | null; wholesalePrice: Prisma.Decimal | null };

const FIELD_COLUMNS: [PriceField, keyof Prices][] = [
  ["REGULAR", "regularPrice"],
  ["OFFER", "offerPrice"],
  ["WHOLESALE", "wholesalePrice"],
];

export const PRICE_COLUMN: Record<PriceField, keyof Prices> = {
  REGULAR: "regularPrice",
  OFFER: "offerPrice",
  WHOLESALE: "wholesalePrice",
};

function differs(a: Prisma.Decimal | null, b: Prisma.Decimal | null) {
  if (a === null || b === null) return a !== b;
  return !a.equals(b);
}

/**
 * Appends one PriceChange row per price field that actually changed. `before`
 * is null for a new variant, which records its opening prices.
 */
export async function recordPriceChanges(
  tx: Tx,
  variantId: string,
  before: Prices | null,
  after: Prices,
  meta: { changedById: string | null; reason?: string | null; batchId?: string },
) {
  const rows = FIELD_COLUMNS.filter(([, col]) => differs(before?.[col] ?? null, after[col])).map(([field, col]) => ({
    variantId,
    field,
    oldPrice: before?.[col] ?? null,
    newPrice: after[col],
    changedById: meta.changedById,
    reason: meta.reason ?? null,
    batchId: meta.batchId ?? null,
  }));
  if (rows.length) await tx.priceChange.createMany({ data: rows });
}
