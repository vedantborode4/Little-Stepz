import { prisma, Prisma, type StockDocumentType, type Tx } from "@repo/crm-db/client";
import type {
  AdjustmentInput,
  BucketMoveInput,
  OpeningStockInput,
  ReverseStockDocumentInput,
  TransferInput,
  WriteOffInput,
} from "@repo/crm-schema";
import { resolveBusinessDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec } from "../../core/money";
import { postStockDocument, type EngineLine } from "./stock-engine";

/** Documents whose units only move around; their reversal needs no cost effect. */
const INTERNAL_TYPES: StockDocumentType[] = ["TRANSFER", "BUCKET_MOVE"];

export async function assertActiveLocations(tx: Tx, ids: string[]) {
  const found = await tx.location.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  if (found.length !== new Set(ids).size) throw new ApiError(400, "INVALID_LOCATION", "Choose an active location");
}

/** New stock may only be posted against active variants of products that aren't archived. */
export async function assertSellableVariants(tx: Tx, ids: string[]) {
  const rows = await tx.variant.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, status: true, product: { select: { status: true } } },
  });
  if (rows.length !== new Set(ids).size) throw new ApiError(400, "INVALID_VARIANT", "One of the items no longer exists");
  const inactive = rows.filter((r) => r.status !== "ACTIVE" || r.product.status === "ARCHIVED").map((r) => r.sku);
  if (inactive.length) throw new ApiError(409, "VARIANT_INACTIVE", `Archived items can't receive stock: ${inactive.join(", ")}`);
}

export async function recordOpeningStock(input: OpeningStockInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  const variantIds = input.lines.map((l) => l.variantId);
  return withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    await assertSellableVariants(tx, variantIds);

    // Opening stock is the starting point of a variant's ledger; later changes are adjustments.
    const started = await tx.stockMovement.findMany({
      where: { variantId: { in: variantIds } },
      distinct: ["variantId"],
      select: { variant: { select: { sku: true } } },
    });
    if (started.length) {
      const skus = started.map((s) => s.variant.sku).join(", ");
      throw new ApiError(409, "OPENING_EXISTS", `These items already have stock history; use an adjustment instead: ${skus}`);
    }

    return postStockDocument(tx, ctx, {
      type: "OPENING",
      businessDate,
      reason: "Opening stock",
      reference: input.reference,
      notes: input.notes,
      lines: input.lines.map((l) => ({
        variantId: l.variantId,
        locationId: input.locationId,
        bucket: input.bucket,
        quantity: l.quantity,
        cost: { kind: "receive", unitCost: l.unitCost ? dec(l.unitCost) : null },
      })),
    });
  });
}

export async function transferStock(input: TransferInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.fromLocationId, input.toLocationId]);
    return postStockDocument(tx, ctx, {
      type: "TRANSFER",
      businessDate,
      reason: input.reason,
      reference: input.reference,
      notes: input.notes,
      lines: input.lines.flatMap((l): EngineLine[] => [
        { variantId: l.variantId, locationId: input.fromLocationId, bucket: input.bucket, quantity: -l.quantity, cost: { kind: "none" } },
        { variantId: l.variantId, locationId: input.toLocationId, bucket: input.bucket, quantity: l.quantity, cost: { kind: "none" } },
      ]),
    });
  });
}

export async function moveBetweenBuckets(input: BucketMoveInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    return postStockDocument(tx, ctx, {
      type: "BUCKET_MOVE",
      businessDate,
      reason: input.reason,
      reasonCode: input.reasonCode,
      reference: input.reference,
      notes: input.notes,
      lines: input.lines.flatMap((l): EngineLine[] => [
        { variantId: l.variantId, locationId: input.locationId, bucket: input.fromBucket, quantity: -l.quantity, cost: { kind: "none" } },
        { variantId: l.variantId, locationId: input.locationId, bucket: input.toBucket, quantity: l.quantity, cost: { kind: "none" } },
      ]),
    });
  });
}

export async function writeOffStock(input: WriteOffInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    return postStockDocument(tx, ctx, {
      type: "WRITE_OFF",
      businessDate,
      reason: input.reason,
      reasonCode: input.reasonCode,
      reference: input.reference,
      notes: input.notes,
      lines: input.lines.map((l) => ({
        variantId: l.variantId,
        locationId: input.locationId,
        bucket: input.bucket,
        quantity: -l.quantity,
        cost: { kind: "issue" },
      })),
    });
  });
}

/** Authorised physical correction. Found units come in at the current average cost (unknown if there is none). */
export async function adjustStock(input: AdjustmentInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    const added = input.lines.filter((l) => l.quantity > 0).map((l) => l.variantId);
    if (added.length) await assertSellableVariants(tx, added);
    return postStockDocument(tx, ctx, {
      type: "ADJUSTMENT",
      businessDate,
      reason: input.reason,
      reasonCode: input.reasonCode,
      reference: input.reference,
      notes: input.notes,
      lines: input.lines.map((l) => ({
        variantId: l.variantId,
        locationId: input.locationId,
        bucket: input.bucket,
        quantity: l.quantity,
        cost: l.quantity > 0 ? { kind: "receiveAtAverage" } : { kind: "issue" },
      })),
    });
  });
}

/**
 * Posts the mirror image of a document at the original costs. Documents created
 * by a purchase or sale are reversed from that purchase or sale instead, so the
 * two records can never disagree.
 */
export async function reverseStockDocument(id: string, input: ReverseStockDocumentInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const original = await tx.stockDocument.findUnique({ where: { id }, include: { lines: true, reversedBy: { select: { code: true } } } });
    if (!original) throw notFound("Stock document");
    if (original.type === "REVERSAL")
      throw new ApiError(409, "CANNOT_REVERSE_REVERSAL", "A reversal can't be reversed. Post a new entry instead.");
    if (original.reversedBy)
      throw new ApiError(409, "ALREADY_REVERSED", `${original.code} was already reversed by ${original.reversedBy.code}`);
    if (original.sourceType) {
      throw new ApiError(
        409,
        "REVERSE_AT_SOURCE",
        `${original.code} was created by a ${original.sourceType.toLowerCase()}; correct it there instead`,
      );
    }

    const internal = INTERNAL_TYPES.includes(original.type);
    const lines: EngineLine[] = original.lines.map((l) => {
      const cost = l.unitCost ? dec(l.unitCost.toString()) : null;
      return {
        variantId: l.variantId,
        locationId: l.locationId,
        bucket: l.bucket,
        quantity: -l.quantity,
        cost: internal ? { kind: "none" } : l.quantity > 0 ? { kind: "unreceive", unitCost: cost } : { kind: "receive", unitCost: cost },
      };
    });

    return postStockDocument(tx, ctx, {
      type: "REVERSAL",
      businessDate: resolveBusinessDate(undefined),
      reason: input.reason,
      reference: original.code,
      reversalOfId: original.id,
      lines,
    });
  });
}

// ─── Read helpers used by other modules ──────────────────────────────────────

/** Physical and available units per variant (available = sellable − reserved; reservations arrive with sales). */
export async function stockTotals(variantIds: string[]): Promise<Map<string, { physical: number; available: number }>> {
  if (variantIds.length === 0) return new Map();
  const rows = await prisma.stockBalance.groupBy({
    by: ["variantId", "bucket"],
    where: { variantId: { in: variantIds } },
    _sum: { quantity: true },
  });
  const totals = new Map(variantIds.map((id) => [id, { physical: 0, available: 0 }]));
  for (const r of rows) {
    const t = totals.get(r.variantId)!;
    const qty = r._sum.quantity ?? 0;
    t.physical += qty;
    if (r.bucket === "SELLABLE") t.available += qty;
  }
  return totals;
}

export async function physicalStockOf(db: Tx | typeof prisma, where: Prisma.StockBalanceWhereInput) {
  const result = await db.stockBalance.aggregate({ where, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}
