import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import type {
  ApproveStockCountInput,
  CreateStockCountInput,
  SaveCountsInput,
  StockCountDetailDto,
  StockCountListItemDto,
  StockCountListQuery,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { resolveBusinessDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, forbidden, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { Decimal, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertActiveLocations, reverseDocumentInTx } from "../inventory/inventory.service";
import { postStockDocument } from "../inventory/stock-engine";

export interface CountRights {
  approve: boolean;
  costs: boolean;
}

const countInclude = {
  location: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  submittedBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  adjustmentDocument: { select: { id: true, code: true, reversedBy: { select: { id: true, code: true } } } },
  lines: {
    include: { variant: { select: { sku: true, name: true, position: true, product: { select: { name: true } } } } },
  },
} satisfies Prisma.StockCountInclude;

type CountRow = Prisma.StockCountGetPayload<{ include: typeof countInclude }>;

/**
 * Blind counts keep the system figure from the people counting, so they count
 * what's on the shelf rather than confirm a number. Approvers always see it;
 * everyone sees it once the count is finished.
 */
const showsSystem = (c: { blind: boolean; status: string }, rights: CountRights) =>
  rights.approve || !c.blind || ["APPROVED", "REVERSED", "CANCELLED"].includes(c.status);

function summary(c: CountRow, show: boolean): StockCountListItemDto {
  const variances = c.lines.filter((l) => l.countedQty !== null).map((l) => l.countedQty! - l.systemQty);
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    location: c.location,
    category: c.category,
    blind: c.blind,
    lineCount: c.lines.length,
    counted: c.lines.filter((l) => l.countedQty !== null).length,
    ...(show && {
      unitsOver: variances.filter((v) => v > 0).reduce((s, v) => s + v, 0),
      unitsShort: variances.filter((v) => v < 0).reduce((s, v) => s - v, 0),
    }),
    createdByName: c.createdBy?.name ?? null,
    createdAt: c.createdAt.toISOString(),
    approvedAt: c.approvedAt?.toISOString() ?? null,
  };
}

async function toDetail(c: CountRow, rights: CountRights): Promise<StockCountDetailDto> {
  const show = showsSystem(c, rights);
  const costs = rights.costs && show;
  const avg = new Map<string, Decimal | null>();
  if (costs) {
    const rows = await prisma.variantCost.findMany({ where: { variantId: { in: c.lines.map((l) => l.variantId) } } });
    for (const r of rows) avg.set(r.variantId, r.valuedQty > 0 ? new Decimal(r.totalValue.toString()).div(r.valuedQty) : null);
  }
  const lines = [...c.lines]
    .sort((a, b) => a.variant.product.name.localeCompare(b.variant.product.name) || a.variant.position - b.variant.position)
    .map((l) => ({
      id: l.id,
      variantId: l.variantId,
      sku: l.variant.sku,
      productName: l.variant.product.name,
      variantName: l.variant.name,
      countedQty: l.countedQty,
      reasonCode: l.reasonCode,
      note: l.note,
      ...(show && { systemQty: l.systemQty, variance: l.countedQty === null ? null : l.countedQty - l.systemQty }),
      ...(costs && { unitCost: avg.get(l.variantId) ? money(avg.get(l.variantId)!) : null }),
    }));
  const impact = costs
    ? c.lines.reduce((s, l) => {
        const cost = avg.get(l.variantId);
        return l.countedQty === null || !cost ? s : s.add(cost.mul(l.countedQty - l.systemQty));
      }, new Decimal(0))
    : null;
  return {
    ...summary(c, show),
    notes: c.notes,
    submittedByName: c.submittedBy?.name ?? null,
    submittedAt: c.submittedAt?.toISOString() ?? null,
    approvedByName: c.approvedBy?.name ?? null,
    cancelReason: c.cancelReason,
    showSystem: show,
    ...(costs && { valueImpact: impact ? money(impact) : null }),
    adjustmentDocument: c.adjustmentDocument ? { id: c.adjustmentDocument.id, code: c.adjustmentDocument.code } : null,
    reversalDocument: c.adjustmentDocument?.reversedBy ?? null,
    lines,
  };
}

export async function getCount(id: string, rights: CountRights) {
  const row = await prisma.stockCount.findUnique({ where: { id }, include: countInclude });
  if (!row) throw notFound("Stock count");
  return toDetail(row, rights);
}

export async function listCounts(query: StockCountListQuery, rights: CountRights) {
  const where: Prisma.StockCountWhereInput = {
    status: query.status,
    locationId: query.locationId,
    ...(query.q && { code: { contains: query.q, mode: "insensitive" } }),
  };
  const [rows, total] = await Promise.all([
    prisma.stockCount.findMany({ where, include: countInclude, orderBy: { createdAt: "desc" }, ...pageWindow(query) }),
    prisma.stockCount.count({ where }),
  ]);
  return paginated(
    rows.map((c) => summary(c, showsSystem(c, rights))),
    total,
    query,
  );
}

async function sellableAt(tx: Tx, locationId: string, variantIds: string[]) {
  const rows = await tx.stockBalance.findMany({ where: { locationId, bucket: "SELLABLE", variantId: { in: variantIds } } });
  return new Map(rows.map((r) => [r.variantId, r.quantity]));
}

/** Starts a count: one line per item in scope, with the system's sellable quantity at this moment. */
export async function createCount(input: CreateStockCountInput, ctx: RequestContext, rights: CountRights) {
  const id = await withTransaction(async (tx) => {
    await assertActiveLocations(tx, [input.locationId]);
    const variants = await tx.variant.findMany({
      where: { status: "ACTIVE", product: { status: { not: "ARCHIVED" }, ...(input.categoryId && { categoryId: input.categoryId }) } },
      select: { id: true },
    });
    const stock = await sellableAt(
      tx,
      input.locationId,
      variants.map((v) => v.id),
    );
    const inScope = variants.filter((v) => input.includeZero || (stock.get(v.id) ?? 0) > 0);
    if (inScope.length === 0) throw new ApiError(409, "NOTHING_TO_COUNT", "Nothing to count here. Include items at zero to count anyway.");
    const count = await tx.stockCount.create({
      data: {
        code: await nextCode(tx, "CNT", 4),
        locationId: input.locationId,
        categoryId: input.categoryId ?? null,
        blind: input.blind,
        notes: input.notes ?? null,
        createdById: ctx.userId,
        lines: { createMany: { data: inScope.map((v) => ({ variantId: v.id, systemQty: stock.get(v.id) ?? 0 })) } },
      },
    });
    await recordAudit(tx, ctx, {
      action: "stockcount.created",
      entity: "StockCount",
      entityId: count.id,
      after: { code: count.code, locationId: input.locationId, lines: inScope.length, blind: input.blind },
    });
    return count.id;
  });
  return getCount(id, rights);
}

async function lockCount(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "StockCount" WHERE id = ${id} FOR UPDATE`;
  const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
  if (!count) throw notFound("Stock count");
  return count;
}

const wrongStatus = (code: string, status: string, action: string) =>
  new ApiError(409, "INVALID_STATUS", `${code} is ${status.toLowerCase()} and can't be ${action}`);

export async function saveCounts(id: string, input: SaveCountsInput, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "OPEN") throw wrongStatus(count.code, count.status, "edited");
    const ids = new Set(count.lines.map((l) => l.id));
    if (input.lines.some((l) => !ids.has(l.lineId))) throw new ApiError(400, "INVALID_LINE", "A line doesn't belong to this count");
    const now = new Date();
    for (const l of input.lines) {
      await tx.stockCountLine.update({
        where: { id: l.lineId },
        data: { countedQty: l.countedQty, countedAt: l.countedQty === null ? null : now },
      });
    }
    await recordAudit(tx, ctx, {
      action: "stockcount.updated",
      entity: "StockCount",
      entityId: id,
      after: { linesSaved: input.lines.length },
    });
  });
  return getCount(id, rights);
}

/** Something on the shelf that wasn't on the list (found stock). */
export async function addLine(id: string, variantId: string, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "OPEN") throw wrongStatus(count.code, count.status, "edited");
    if (count.lines.some((l) => l.variantId === variantId)) throw new ApiError(409, "ALREADY_LISTED", "That item is already on the count");
    const variant = await tx.variant.findUnique({ where: { id: variantId }, select: { sku: true } });
    if (!variant) throw new ApiError(400, "INVALID_VARIANT", "That item doesn't exist");
    const stock = await sellableAt(tx, count.locationId, [variantId]);
    await tx.stockCountLine.create({ data: { countId: id, variantId, systemQty: stock.get(variantId) ?? 0 } });
    await recordAudit(tx, ctx, { action: "stockcount.updated", entity: "StockCount", entityId: id, after: { addedSku: variant.sku } });
  });
  return getCount(id, rights);
}

export async function submitCount(id: string, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "OPEN") throw wrongStatus(count.code, count.status, "submitted");
    const missing = count.lines.filter((l) => l.countedQty === null).length;
    if (missing)
      throw new ApiError(409, "UNCOUNTED_LINES", `${missing} item(s) haven't been counted yet; enter 0 for anything not found`, {
        missing,
      });
    await tx.stockCount.update({ where: { id }, data: { status: "SUBMITTED", submittedById: ctx.userId, submittedAt: new Date() } });
    await recordAudit(tx, ctx, {
      action: "stockcount.submitted",
      entity: "StockCount",
      entityId: id,
      after: { code: count.code, lines: count.lines.length },
    });
  });
  return getCount(id, rights);
}

export async function sendBack(id: string, reason: string, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "SUBMITTED") throw wrongStatus(count.code, count.status, "sent back");
    await tx.stockCount.update({ where: { id }, data: { status: "OPEN", submittedById: null, submittedAt: null } });
    await recordAudit(tx, ctx, { action: "stockcount.sent_back", entity: "StockCount", entityId: id, metadata: { reason } });
  });
  return getCount(id, rights);
}

/**
 * Posts every difference as one ADJUSTMENT document tagged with this count:
 * found units come in at the current average cost, missing units leave at it.
 * The adjustment is applied to today's balance, i.e. movements made while the
 * count was going on are assumed to have happened after the snapshot.
 */
export async function approveCount(id: string, input: ApproveStockCountInput, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "SUBMITTED") throw wrongStatus(count.code, count.status, "approved");
    const reasons = new Map(input.lines.map((l) => [l.lineId, l]));
    const differences = count.lines.filter((l) => l.countedQty! !== l.systemQty);

    for (const l of differences) {
      const r = reasons.get(l.id);
      await tx.stockCountLine.update({
        where: { id: l.id },
        data: { reasonCode: r?.reasonCode ?? "COUNT_CORRECTION", note: r?.note ?? null },
      });
    }
    const document = differences.length
      ? await postStockDocument(tx, ctx, {
          type: "ADJUSTMENT",
          businessDate: resolveBusinessDate(undefined),
          reason: `Stock count ${count.code}: ${input.reason}`,
          reasonCode: "COUNT_CORRECTION",
          reference: count.code,
          sourceType: "STOCK_COUNT",
          sourceId: count.id,
          lines: differences.map((l) => {
            const quantity = l.countedQty! - l.systemQty;
            return {
              variantId: l.variantId,
              locationId: count.locationId,
              bucket: "SELLABLE" as const,
              quantity,
              cost: quantity > 0 ? { kind: "receiveAtAverage" as const } : { kind: "issue" as const },
            };
          }),
        })
      : null;

    await tx.stockCount.update({
      where: { id },
      data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date(), adjustmentDocumentId: document?.id ?? null },
    });
    await recordAudit(tx, ctx, {
      action: "stockcount.approved",
      entity: "StockCount",
      entityId: id,
      after: {
        code: count.code,
        reason: input.reason,
        document: document?.code ?? null,
        differences: differences.map((l) => ({ variantId: l.variantId, system: l.systemQty, counted: l.countedQty })),
      },
    });
  });
  return getCount(id, rights);
}

export async function cancelCount(id: string, reason: string, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "OPEN" && count.status !== "SUBMITTED") throw wrongStatus(count.code, count.status, "cancelled");
    if (count.status === "SUBMITTED" && !rights.approve) throw forbidden("A submitted count can only be cancelled by an approver");
    await tx.stockCount.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await recordAudit(tx, ctx, { action: "stockcount.cancelled", entity: "StockCount", entityId: id, metadata: { reason } });
  });
  return getCount(id, rights);
}

/** Undoes an approved count's adjustment with a reversal document; the count stays on record as reversed. */
export async function reverseCount(id: string, reason: string, ctx: RequestContext, rights: CountRights) {
  await withTransaction(async (tx) => {
    const count = await lockCount(tx, id);
    if (count.status !== "APPROVED") throw wrongStatus(count.code, count.status, "reversed");
    if (!count.adjustmentDocumentId)
      throw new ApiError(409, "NOTHING_TO_REVERSE", `${count.code} found no differences, so there's nothing to reverse`);
    const reversal = await reverseDocumentInTx(tx, ctx, count.adjustmentDocumentId, `Reversal of stock count ${count.code}: ${reason}`);
    await tx.stockCount.update({ where: { id }, data: { status: "REVERSED" } });
    await recordAudit(tx, ctx, {
      action: "stockcount.reversed",
      entity: "StockCount",
      entityId: id,
      after: { code: count.code, reversal: reversal.code, reason },
    });
  });
  return getCount(id, rights);
}
