import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type { LandedCostEntryDto, SetLandedCostPreviewDto, SetLandedCostPreviewInput, SetLandedCostInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec, Decimal, decOrZero, money, moneyOrNull } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { netCommission } from "../commission/commission.service";
import { returnLineAmounts } from "../returns/return-maths";
import { averageCost } from "./cost";
import { lockVariants } from "./stock-engine";

type Db = Tx | typeof prisma;

const round6 = (v: Decimal) => v.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
const decimal = (v: { toString(): string }) => dec(v.toString());

/**
 * Where a variant's cost stands: stock on hand (and how much of it has no cost),
 * units sold with no cost, and units sold at a cost an earlier entry set.
 * Workbook-imported past sales are not part of it: no stock moved for them.
 */
export interface CostPosition {
  stockQty: number;
  unvaluedQty: number;
  totalValue: Decimal;
  unknownSoldQty: number;
  tracked: { unitCost: Decimal; quantity: number }[];
}

export async function costPositions(db: Db, variantIds: string[]): Promise<Map<string, CostPosition>> {
  const [costs, unknown, tracked] = await Promise.all([
    db.variantCost.findMany({ where: { variantId: { in: variantIds } } }),
    db.salesOrderLine.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds }, unknownCostQty: { gt: 0 }, order: { importBatchId: null } },
      _sum: { unknownCostQty: true },
    }),
    db.landedCostSaleLine.findMany({
      where: { variantId: { in: variantIds } },
      select: { variantId: true, unitCost: true, quantity: true },
    }),
  ]);
  return new Map(
    variantIds.map((id) => {
      const cost = costs.find((c) => c.variantId === id);
      return [
        id,
        {
          stockQty: (cost?.valuedQty ?? 0) + (cost?.unvaluedQty ?? 0),
          unvaluedQty: cost?.unvaluedQty ?? 0,
          totalValue: cost ? decimal(cost.totalValue) : new Decimal(0),
          unknownSoldQty: unknown.find((u) => u.variantId === id)?._sum.unknownCostQty ?? 0,
          tracked: tracked.filter((t) => t.variantId === id).map((t) => ({ unitCost: decimal(t.unitCost), quantity: t.quantity })),
        },
      ];
    }),
  );
}

/** Whether setting `unitCost` would change any stock value or sale cost. */
export function wouldChange(p: CostPosition, unitCost: Decimal) {
  return (
    p.unvaluedQty > 0 ||
    p.unknownSoldQty > 0 ||
    !p.totalValue.eq(round6(unitCost.mul(p.stockQty))) ||
    p.tracked.some((t) => !t.unitCost.eq(unitCost))
  );
}

export function unchangedMessage(sku: string, p: CostPosition) {
  return p.stockQty === 0 && p.tracked.length === 0
    ? `${sku} has no stock on hand and no sales without a cost; there is nothing to cost`
    : `${sku} is already at this landed cost; nothing would change`;
}

type Effect = Omit<SetLandedCostPreviewDto, "untouchedHistoricalQty" | "commission">;

/**
 * Sets a variant's landed cost per piece, inside the caller's transaction:
 * - stock on hand (every location and bucket) is revalued to the new cost;
 * - sales lines that left with an unknown cost get it, and lines an earlier entry
 *   costed are re-costed; lines that left with a known cost never change;
 * - those lines' returns are worked out again from the new cost, in the order they happened.
 * Returns null, writing nothing, when nothing would change.
 */
export async function setLandedCostInTx(
  tx: Tx,
  ctx: RequestContext,
  variantId: string,
  unitCost: Decimal,
  reason: string,
  importBatchId: string | null = null,
): Promise<{ entryId: string; effect: Effect } | null> {
  await lockVariants(tx, [variantId]);
  const variant = await tx.variant.findUnique({ where: { id: variantId }, select: { sku: true } });
  if (!variant) throw notFound("Item");
  const position = (await costPositions(tx, [variantId])).get(variantId)!;
  if (!wouldChange(position, unitCost)) return null;

  const { stockQty, unvaluedQty, totalValue } = position;
  const previousUnitCost = averageCost({ valuedQty: stockQty - unvaluedQty, totalValue, unvaluedQty });
  const stockValueAfter = round6(unitCost.mul(stockQty));

  const lines = await tx.salesOrderLine.findMany({
    where: { variantId, order: { importBatchId: null }, OR: [{ unknownCostQty: { gt: 0 } }, { landedCost: { isNot: null } }] },
    select: {
      id: true,
      orderId: true,
      quantity: true,
      lineTotal: true,
      taxableValue: true,
      cogs: true,
      unknownCostQty: true,
      landedCost: { select: { quantity: true, unitCost: true } },
      returnLines: {
        select: {
          id: true,
          quantity: true,
          amount: true,
          taxableValue: true,
          cogs: true,
          unknownCostQty: true,
          condition: true,
          salesReturn: { select: { createdAt: true } },
        },
      },
    },
  });

  const changes = lines.flatMap((line) => {
    const earlier = line.landedCost ? { quantity: line.landedCost.quantity, unitCost: decimal(line.landedCost.unitCost) } : null;
    const recosted = earlier && !earlier.unitCost.eq(unitCost) ? earlier.quantity : 0;
    if (line.unknownCostQty === 0 && recosted === 0) return [];
    const delta = round6(unitCost.mul(line.unknownCostQty)).add(earlier ? round6(unitCost.sub(earlier.unitCost).mul(earlier.quantity)) : 0);
    const cogs = decOrZero(line.cogs).add(delta);
    const sold = {
      sku: variant.sku,
      quantity: line.quantity,
      lineTotal: decimal(line.lineTotal),
      taxableValue: decimal(line.taxableValue),
      cogs,
      unknownCostQty: 0,
    };

    let prior = { quantity: 0, amount: new Decimal(0), taxableValue: new Decimal(0), cogs: new Decimal(0), knownQty: 0 };
    const returns = [...line.returnLines]
      .sort((a, b) => a.salesReturn.createdAt.getTime() - b.salesReturn.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((r) => {
        const next = returnLineAmounts(sold, prior, r.quantity);
        prior = {
          quantity: prior.quantity + r.quantity,
          amount: prior.amount.add(decimal(r.amount)),
          taxableValue: prior.taxableValue.add(decimal(r.taxableValue)),
          cogs: prior.cogs.add(next.cogs),
          knownQty: prior.knownQty + next.knownQty,
        };
        const restocked = r.condition !== "WRITE_OFF";
        return {
          id: r.id,
          cogs: next.cogs,
          unknownCostQty: next.unknownCostQty,
          cogsDelta: restocked ? next.cogs.sub(decimal(r.cogs)) : new Decimal(0),
        };
      });

    return [
      { line, cogs, delta, filled: line.unknownCostQty, recosted, quantity: line.unknownCostQty + (earlier?.quantity ?? 0), returns },
    ];
  });

  const filledSoldQty = changes.reduce((s, c) => s + c.filled, 0);
  const recostedSoldQty = changes.reduce((s, c) => s + c.recosted, 0);
  // Written-off returns never come back, so their cost stays a loss; restocked ones take their cost back out.
  const cogsChange = changes.reduce((s, c) => c.returns.reduce((t, r) => t.sub(r.cogsDelta), s.add(c.delta)), new Decimal(0));

  const entry = await tx.landedCostEntry.create({
    data: {
      code: await nextCode(tx, "LCE", 5),
      variantId,
      unitCost,
      previousUnitCost,
      stockQty,
      unknownStockQty: unvaluedQty,
      stockValueChange: stockValueAfter.sub(totalValue),
      filledSoldQty,
      recostedSoldQty,
      cogsChange,
      reason,
      importBatchId,
      createdById: ctx.userId,
    },
  });
  // Sold lines and returns are locked once costed; the database lets this entry's own transaction re-cost them.
  await tx.$queryRaw`SELECT set_config('crm.landed_cost_entry', ${entry.id}, true)`;
  await tx.variantCost.update({ where: { variantId }, data: { valuedQty: stockQty, totalValue: stockValueAfter, unvaluedQty: 0 } });
  for (const c of changes) {
    await tx.salesOrderLine.update({ where: { id: c.line.id }, data: { cogs: c.cogs, unknownCostQty: 0 } });
    await tx.landedCostSaleLine.upsert({
      where: { orderLineId: c.line.id },
      create: { orderLineId: c.line.id, variantId, quantity: c.quantity, unitCost, entryId: entry.id },
      update: { quantity: c.quantity, unitCost, entryId: entry.id },
    });
    for (const r of c.returns) {
      await tx.salesReturnLine.update({ where: { id: r.id }, data: { cogs: r.cogs, unknownCostQty: r.unknownCostQty } });
    }
  }

  const effect: Effect = {
    sku: variant.sku,
    unitCost: money(unitCost),
    previousUnitCost: moneyOrNull(previousUnitCost),
    stockQty,
    unknownStockQty: unvaluedQty,
    stockValueBefore: money(totalValue),
    stockValueAfter: money(stockValueAfter),
    filledSoldQty,
    recostedSoldQty,
    orders: new Set(changes.map((c) => c.line.orderId)).size,
    cogsChange: money(cogsChange),
  };
  await recordAudit(tx, ctx, {
    action: "stock.landed_cost_set",
    entity: "LandedCostEntry",
    entityId: entry.id,
    before: { averageCost: effect.previousUnitCost, stockValue: effect.stockValueBefore, unknownStockQty: unvaluedQty },
    after: { code: entry.code, ...effect, reason, saleLines: changes.map((c) => c.line.id) },
  });
  return { entryId: entry.id, effect };
}

async function skuOf(db: Db, variantId: string) {
  const variant = await db.variant.findUnique({ where: { id: variantId }, select: { sku: true } });
  if (!variant) throw notFound("Item");
  return variant.sku;
}

const unchanged = async (db: Db, variantId: string) => {
  const sku = await skuOf(db, variantId);
  const position = (await costPositions(db, [variantId])).get(variantId)!;
  return new ApiError(409, "LANDED_COST_UNCHANGED", unchangedMessage(sku, position));
};

export async function setLandedCost(variantId: string, input: SetLandedCostInput, ctx: RequestContext): Promise<LandedCostEntryDto> {
  const result = await withTransaction((tx) => setLandedCostInTx(tx, ctx, variantId, dec(input.unitCost), input.reason));
  if (!result) throw await unchanged(prisma, variantId);
  return toEntryDto(await prisma.landedCostEntry.findUniqueOrThrow({ where: { id: result.entryId }, include: entryInclude }));
}

class PreviewDone extends Error {
  constructor(readonly preview: SetLandedCostPreviewDto | null) {
    super("Landed cost preview rolled back");
  }
}

/** Salespeople whose commission could move: those on fulfilled, stock-moving sales of the item that a cost would touch. */
async function salespeopleOn(db: Db, variantId: string) {
  const orders = await db.salesOrder.findMany({
    where: {
      importBatchId: null,
      salespersonId: { not: null },
      fulfilledDate: { not: null },
      lines: { some: { variantId, OR: [{ unknownCostQty: { gt: 0 } }, { landedCost: { isNot: null } }] } },
    },
    distinct: ["salespersonId"],
    select: { salesperson: { select: { id: true, name: true, staffCode: true } } },
  });
  return orders.map((o) => o.salesperson!);
}

/**
 * Exactly what setting the cost would do: the real change runs in a transaction
 * that is then rolled back, so the preview can never drift from the real thing.
 */
export async function previewLandedCost(
  variantId: string,
  input: SetLandedCostPreviewInput,
  ctx: RequestContext,
): Promise<SetLandedCostPreviewDto> {
  const done = await withTransaction(async (tx) => {
    const people = await salespeopleOn(tx, variantId);
    const ids = people.map((p) => p.id);
    const before = await netCommission(tx, ids);
    const result = await setLandedCostInTx(tx, ctx, variantId, dec(input.unitCost), "Preview");
    if (!result) throw new PreviewDone(null);
    const [after, historical] = await Promise.all([
      netCommission(tx, ids),
      tx.salesOrderLine.aggregate({
        where: { variantId, unknownCostQty: { gt: 0 }, order: { importBatchId: { not: null } } },
        _sum: { unknownCostQty: true },
      }),
    ]);
    throw new PreviewDone({
      ...result.effect,
      untouchedHistoricalQty: historical._sum.unknownCostQty ?? 0,
      commission: people
        .map((p) => ({ salespersonId: p.id, name: p.name, staffCode: p.staffCode, change: after.get(p.id)!.sub(before.get(p.id)!) }))
        .filter((p) => !p.change.isZero())
        .map((p) => ({ ...p, change: money(p.change) })),
    });
  }).catch((err: unknown) => {
    if (err instanceof PreviewDone) return err;
    throw err;
  });
  if (done.preview) return done.preview;
  throw await unchanged(prisma, variantId);
}

const entryInclude = { createdBy: { select: { name: true } }, importBatch: { select: { code: true } } } as const;

type EntryRow = Prisma.LandedCostEntryGetPayload<{ include: typeof entryInclude }>;

function toEntryDto(e: EntryRow): LandedCostEntryDto {
  return {
    id: e.id,
    code: e.code,
    unitCost: money(decimal(e.unitCost)),
    previousUnitCost: e.previousUnitCost ? money(decimal(e.previousUnitCost)) : null,
    stockQty: e.stockQty,
    unknownStockQty: e.unknownStockQty,
    stockValueChange: money(decimal(e.stockValueChange)),
    filledSoldQty: e.filledSoldQty,
    recostedSoldQty: e.recostedSoldQty,
    cogsChange: money(decimal(e.cogsChange)),
    reason: e.reason,
    importBatchCode: e.importBatch?.code ?? null,
    createdByName: e.createdBy?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function landedCostHistory(variantId: string): Promise<LandedCostEntryDto[]> {
  const rows = await prisma.landedCostEntry.findMany({
    where: { variantId },
    include: entryInclude,
    orderBy: [{ createdAt: "desc" }, { code: "desc" }],
    take: 50,
  });
  return rows.map(toEntryDto);
}
