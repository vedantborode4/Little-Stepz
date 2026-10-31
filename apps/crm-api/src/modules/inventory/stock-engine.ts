import { Prisma, type StockBucket, type StockDocumentType, type StockReasonCode, type Tx } from "@repo/crm-db/client";
import { recordAudit } from "../../core/audit";
import { ApiError, type RequestContext } from "../../core/http";
import { Decimal } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { averageCost, issue, receive, unreceive, type CostState } from "./cost";

/**
 * How a line affects the variant's cost:
 * - receive: units arrive at a known (or unknown = null) cost
 * - receiveAtAverage: units arrive at the current average (found stock)
 * - issue: units leave at the current average (unknown-cost units first)
 * - unreceive: a reversal takes back units at the cost they arrived at
 * - none: units only move between locations or buckets
 */
export type CostEffect =
  | { kind: "receive"; unitCost: Decimal | null }
  | { kind: "receiveAtAverage" }
  | { kind: "issue" }
  | { kind: "unreceive"; unitCost: Decimal | null }
  | { kind: "none"; unitCost?: Decimal | null };

export interface EngineLine {
  variantId: string;
  locationId: string;
  bucket: StockBucket;
  /** Signed: positive adds units, negative removes them. */
  quantity: number;
  cost: CostEffect;
}

export interface PostStockDocumentInput {
  type: StockDocumentType;
  businessDate: Date;
  reason: string;
  reasonCode?: StockReasonCode | null;
  reference?: string | null;
  notes?: string | null;
  sourceType?: string;
  sourceId?: string;
  reversalOfId?: string;
  lines: EngineLine[];
}

type MovementRow = { variantId: string; locationId: string; bucket: StockBucket; quantity: number; unitCost: Decimal | null };

/**
 * Locks the cost rows of every variant involved, in a fixed order. All stock writes
 * for a variant serialise on this lock, which keeps balances and costs consistent
 * under concurrent postings and rules out deadlocks between them.
 */
async function lockCostStates(tx: Tx, variantIds: string[]): Promise<Map<string, CostState>> {
  const ids = [...new Set(variantIds)].sort();
  await tx.$executeRaw`
    INSERT INTO "VariantCost" ("variantId", "updatedAt")
    SELECT id, now() FROM unnest(${ids}::text[]) AS id
    ON CONFLICT ("variantId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ variantId: string; valuedQty: number; totalValue: Prisma.Decimal; unvaluedQty: number }[]>`
    SELECT "variantId", "valuedQty", "totalValue", "unvaluedQty" FROM "VariantCost"
    WHERE "variantId" IN (${Prisma.join(ids)}) ORDER BY "variantId" FOR UPDATE`;
  return new Map(
    rows.map((r) => [
      r.variantId,
      { valuedQty: r.valuedQty, totalValue: new Decimal(r.totalValue.toString()), unvaluedQty: r.unvaluedQty },
    ]),
  );
}

/** Takes the per-variant stock lock without posting anything (reservations need the same serialisation). */
export async function lockVariants(tx: Tx, variantIds: string[]) {
  await lockCostStates(tx, variantIds);
}

/**
 * Units reserved for confirmed orders can't be taken by anything else: after a
 * removal from SELLABLE, what remains at that location must still cover the
 * active reservations there. Fulfilling an order releases its own reservation
 * first, so it passes; a walk-in sale or write-off of held units does not.
 */
async function assertReservationsCovered(tx: Tx, lines: EngineLine[]) {
  const keys = new Map<string, EngineLine>();
  for (const l of lines) if (l.quantity < 0 && l.bucket === "SELLABLE") keys.set(`${l.variantId}|${l.locationId}`, l);
  for (const line of keys.values()) {
    const [balance, reserved] = await Promise.all([
      tx.stockBalance.findUnique({
        where: { variantId_locationId_bucket: { variantId: line.variantId, locationId: line.locationId, bucket: "SELLABLE" } },
      }),
      tx.reservation.aggregate({
        where: { variantId: line.variantId, locationId: line.locationId, releasedAt: null },
        _sum: { quantity: true },
      }),
    ]);
    const held = reserved._sum.quantity ?? 0;
    const left = balance?.quantity ?? 0;
    if (left >= held) continue;
    const variant = await tx.variant.findUnique({ where: { id: line.variantId }, select: { sku: true } });
    const free = left + -line.quantity - held;
    throw new ApiError(
      409,
      "STOCK_RESERVED",
      `Only ${Math.max(free, 0)} of ${variant?.sku} are free; ${held} are reserved for confirmed orders`,
      { sku: variant?.sku, available: Math.max(free, 0), reserved: held, needed: -line.quantity },
    );
  }
}

async function insufficientStock(tx: Tx, line: EngineLine, needed: number): Promise<never> {
  const [variant, location, balance] = await Promise.all([
    tx.variant.findUnique({ where: { id: line.variantId }, select: { sku: true } }),
    tx.location.findUnique({ where: { id: line.locationId }, select: { code: true } }),
    tx.stockBalance.findUnique({
      where: { variantId_locationId_bucket: { variantId: line.variantId, locationId: line.locationId, bucket: line.bucket } },
    }),
  ]);
  const have = balance?.quantity ?? 0;
  throw new ApiError(
    409,
    "STOCK_INSUFFICIENT",
    `Not enough ${line.bucket.toLowerCase()} stock of ${variant?.sku} at ${location?.code}: ${have} available, ${needed} needed`,
    { sku: variant?.sku, location: location?.code, bucket: line.bucket, available: have, needed },
  );
}

/** Applies one line to the balance cache. Removals are guarded so stock can never go below zero. */
async function applyBalance(tx: Tx, line: EngineLine) {
  const key = { variantId: line.variantId, locationId: line.locationId, bucket: line.bucket };
  if (line.quantity < 0) {
    const needed = -line.quantity;
    const updated = await tx.stockBalance.updateMany({
      where: { ...key, quantity: { gte: needed } },
      data: { quantity: { decrement: needed } },
    });
    if (updated.count !== 1) await insufficientStock(tx, line, needed);
    return;
  }
  await tx.stockBalance.upsert({
    where: { variantId_locationId_bucket: key },
    create: { ...key, quantity: line.quantity },
    update: { quantity: { increment: line.quantity } },
  });
}

function applyCost(states: Map<string, CostState>, line: EngineLine): MovementRow[] {
  const state = states.get(line.variantId)!;
  const base = { variantId: line.variantId, locationId: line.locationId, bucket: line.bucket };
  const qty = Math.abs(line.quantity);

  switch (line.cost.kind) {
    case "receive":
      states.set(line.variantId, receive(state, qty, line.cost.unitCost));
      return [{ ...base, quantity: qty, unitCost: line.cost.unitCost }];
    case "receiveAtAverage": {
      const avg = averageCost(state);
      states.set(line.variantId, receive(state, qty, avg));
      return [{ ...base, quantity: qty, unitCost: avg }];
    }
    case "issue": {
      const result = issue(state, qty);
      states.set(line.variantId, result.state);
      return result.parts.map((p) => ({ ...base, quantity: -p.quantity, unitCost: p.unitCost }));
    }
    case "unreceive":
      states.set(line.variantId, unreceive(state, qty, line.cost.unitCost));
      return [{ ...base, quantity: -qty, unitCost: line.cost.unitCost }];
    case "none":
      return [{ ...base, quantity: line.quantity, unitCost: line.cost.unitCost ?? null }];
  }
}

/**
 * The only writer of stock. Posts one document — balances, costs, movement lines
 * and audit — inside the caller's transaction, so it commits or fails as a whole.
 */
export async function postStockDocument(tx: Tx, ctx: RequestContext, input: PostStockDocumentInput) {
  if (input.lines.length === 0) throw new ApiError(400, "NO_LINES", "Add at least one item");
  if (input.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity === 0)) {
    throw new ApiError(400, "INVALID_QUANTITY", "Quantities must be whole, non-zero numbers");
  }

  const states = await lockCostStates(
    tx,
    input.lines.map((l) => l.variantId),
  );

  // Removals first, so a document that moves units out and back in never trips the guard on itself.
  const ordered = [...input.lines].sort((a, b) => Math.sign(a.quantity) - Math.sign(b.quantity));
  for (const line of ordered) await applyBalance(tx, line);
  await assertReservationsCovered(tx, input.lines);

  const rows = input.lines.flatMap((line) => applyCost(states, line));

  const document = await tx.stockDocument.create({
    data: {
      code: await nextCode(tx, "STK", 5),
      type: input.type,
      businessDate: input.businessDate,
      reason: input.reason,
      reasonCode: input.reasonCode ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      createdById: ctx.userId,
      lines: { createMany: { data: rows } },
    },
  });

  for (const [variantId, state] of states) {
    await tx.variantCost.update({ where: { variantId }, data: state });
  }

  await recordAudit(tx, ctx, {
    action: input.reversalOfId ? "stock.reversed" : "stock.posted",
    entity: "StockDocument",
    entityId: document.id,
    after: {
      code: document.code,
      type: input.type,
      reason: input.reason,
      lines: rows.map((r) => ({ variantId: r.variantId, locationId: r.locationId, bucket: r.bucket, quantity: r.quantity })),
    },
  });

  return document;
}

/**
 * Changes the value of a variant's stock without moving units (a late purchase
 * charge). Returns the amount actually applied: value can only attach to units
 * that already carry a known cost, so with none on hand nothing is applied and
 * the caller expenses the charge instead.
 */
export async function revalueStock(tx: Tx, variantId: string, delta: Decimal): Promise<Decimal> {
  const states = await lockCostStates(tx, [variantId]);
  const state = states.get(variantId)!;
  if (state.valuedQty === 0 || delta.isZero()) return new Decimal(0);
  const applied = delta.isNegative() ? Decimal.max(delta, state.totalValue.neg()) : delta;
  await tx.variantCost.update({ where: { variantId }, data: { totalValue: state.totalValue.add(applied) } });
  return applied;
}
