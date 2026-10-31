import { randomUUID } from "crypto";
import { prisma, Prisma } from "@repo/crm-db/client";
import type { BulkPriceApplyInput, BulkPriceOperation, BulkPricePreviewInput, BulkPricePreviewRowDto, PriceField } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, type RequestContext } from "../../core/http";
import { dec, Decimal, moneyOrNull, sameMoney } from "../../core/money";
import { PRICE_COLUMN, recordPriceChanges } from "./price-history";

/** More rows than this can't be reviewed sensibly; the user narrows the scope instead. */
const MAX_BULK_ROWS = 2000;

const HUNDRED = new Decimal(100);

function computeNewPrice(
  operation: BulkPriceOperation,
  current: Decimal | null,
  regular: Decimal,
  value: Decimal | null,
): Decimal | null | "NO_BASE" {
  switch (operation) {
    case "CLEAR":
      return null;
    case "SET_AMOUNT":
      return value!;
    case "PERCENT_OFF_REGULAR":
      return regular.mul(HUNDRED.sub(value!)).div(HUNDRED);
  }
  if (!current) return "NO_BASE";
  switch (operation) {
    case "INCREASE_PERCENT":
      return current.mul(HUNDRED.add(value!)).div(HUNDRED);
    case "DECREASE_PERCENT":
      return current.mul(HUNDRED.sub(value!)).div(HUNDRED);
    case "INCREASE_AMOUNT":
      return current.add(value!);
    case "DECREASE_AMOUNT":
      return current.sub(value!);
  }
}

type PricedVariant = { regularPrice: Decimal; offerPrice: Decimal | null; wholesalePrice: Decimal | null };

/** Why a proposed price is not allowed, or null when it is. */
function priceProblem(field: PriceField, next: Decimal | null, variant: PricedVariant): string | null {
  if (next === null) return field === "REGULAR" ? "The regular price can't be removed" : null;
  if (next.lte(0)) return "Price would be zero or negative";
  if (field === "REGULAR") {
    if (variant.offerPrice?.gt(next)) return "Below the current offer price";
    if (variant.wholesalePrice?.gt(next)) return "Below the current wholesale price";
    return null;
  }
  return next.gt(variant.regularPrice) ? "Above the regular price" : null;
}

export async function previewBulkPrice(input: BulkPricePreviewInput): Promise<BulkPricePreviewRowDto[]> {
  const where: Prisma.VariantWhereInput = {
    status: "ACTIVE",
    product: {
      status: { not: "ARCHIVED" },
      categoryId: input.categoryId,
      brandId: input.brandId,
      ...(input.q && {
        OR: [{ name: { contains: input.q, mode: "insensitive" } }, { code: { contains: input.q, mode: "insensitive" } }],
      }),
    },
  };
  const count = await prisma.variant.count({ where });
  if (count > MAX_BULK_ROWS) {
    throw new ApiError(400, "TOO_MANY_ROWS", `${count} variants match. Narrow the selection to ${MAX_BULK_ROWS} or fewer.`);
  }

  const variants = await prisma.variant.findMany({
    where,
    include: { product: { select: { id: true, name: true } } },
    orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
  });

  const value = input.value ? dec(input.value) : null;
  const column = PRICE_COLUMN[input.field];

  return variants.flatMap((v) => {
    const current = v[column];
    const raw = computeNewPrice(input.operation, current, v.regularPrice, value);
    const base = {
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      variantName: v.name,
      sku: v.sku,
      oldPrice: moneyOrNull(current),
    };

    if (raw === "NO_BASE") return [{ ...base, newPrice: null, error: "No current price to adjust" }];
    const next =
      raw && (input.roundToRupee ? raw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : raw.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN));
    if (sameMoney(current, moneyOrNull(next))) return [];
    return [{ ...base, newPrice: moneyOrNull(next), error: priceProblem(input.field, next, v) }];
  });
}

/**
 * Applies exactly the rows the user confirmed. Each row carries the price the
 * user saw; if any price moved since the preview the whole batch is refused,
 * so a stale preview can never overwrite a newer edit.
 */
export async function applyBulkPrice(input: BulkPriceApplyInput, ctx: RequestContext) {
  const batchId = randomUUID();
  const column = PRICE_COLUMN[input.field];
  const ids = input.changes.map((c) => c.variantId);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "DUPLICATE_ROWS", "Each variant can appear only once");

  return withTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Variant" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
    const variants = new Map((await tx.variant.findMany({ where: { id: { in: ids } } })).map((v) => [v.id, v]));

    const applied: { sku: string; oldPrice: string | null; newPrice: string | null }[] = [];
    for (const change of input.changes) {
      const variant = variants.get(change.variantId);
      if (!variant) throw new ApiError(404, "NOT_FOUND", "A variant in this batch no longer exists. Preview again.");
      if (!sameMoney(variant[column], change.expectedOldPrice)) {
        throw new ApiError(
          409,
          "PRICE_CHANGED_SINCE_PREVIEW",
          `The ${input.field.toLowerCase()} price of ${variant.sku} changed after the preview. Preview again.`,
        );
      }
      const next = change.newPrice === null ? null : dec(change.newPrice);
      const problem = priceProblem(input.field, next, variant);
      if (problem) throw new ApiError(400, "INVALID_PRICE", `${variant.sku}: ${problem}`);

      const updated = await tx.variant.update({ where: { id: variant.id }, data: { [column]: next } });
      await recordPriceChanges(tx, variant.id, variant, updated, { changedById: ctx.userId, reason: input.reason, batchId });
      applied.push({ sku: variant.sku, oldPrice: change.expectedOldPrice, newPrice: change.newPrice });
    }

    await recordAudit(tx, ctx, {
      action: "price.bulk_updated",
      entity: "PriceBatch",
      entityId: batchId,
      after: { field: input.field, changes: applied },
      metadata: { count: applied.length, reason: input.reason },
    });
    return { batchId, updated: applied.length };
  });
}
