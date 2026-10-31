import { randomUUID } from "crypto";
import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import type {
  LandedCostInput,
  LateChargeInput,
  PurchaseDraftInput,
  PurchaseListQuery,
  PurchaseReturnInput,
  ReceivePurchaseInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { fromDbDate, resolveBusinessDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { dec, Decimal } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertActiveLocations, assertSellableVariants, physicalStockOf } from "../inventory/inventory.service";
import { postStockDocument, revalueStock } from "../inventory/stock-engine";
import { allocate, allocationWeights, chargeToInr, computeLandedCost, type LandedLine } from "./landed-cost";
import { purchaseDetailInclude, toPurchaseDetailDto, toPurchaseListItemDto, type Visibility } from "./purchases.mappers";

const SORTABLE = { invoiceDate: "invoiceDate", code: "code", createdAt: "createdAt", supplier: "supplier.name" };

const landedLines = (lines: { quantity: number; unitPrice: string; weightKg?: string | null; cbm?: string | null }[]): LandedLine[] =>
  lines.map((l) => ({
    quantity: l.quantity,
    unitPrice: dec(l.unitPrice),
    weightKg: l.weightKg ? dec(l.weightKg) : null,
    cbm: l.cbm ? dec(l.cbm) : null,
  }));

/** Landed cost for an unsaved draft — the same maths the receipt freezes. */
export function previewLandedCost(input: LandedCostInput) {
  const rate = dec(input.exchangeRate);
  return computeLandedCost({
    exchangeRate: rate,
    method: input.allocationMethod,
    lines: landedLines(input.lines),
    charges: input.charges.map((c) => ({ amountInr: chargeToInr(dec(c.amount), c.currency, rate), isRecoverableTax: c.isRecoverableTax })),
  });
}

export async function listPurchases(query: PurchaseListQuery, visibility: Visibility) {
  const where: Prisma.PurchaseShipmentWhereInput = {
    supplierId: query.supplierId,
    status: query.status,
    invoiceDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { invoiceNumber: { contains: query.q, mode: "insensitive" } },
        { shipmentRef: { contains: query.q, mode: "insensitive" } },
        { supplier: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.purchaseShipment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        location: { select: { name: true } },
        lines: { select: { quantity: true, unitPriceInr: true, allocatedCharges: true } },
      },
      orderBy: buildOrderBy(query.sort, SORTABLE, "invoiceDate:desc", "createdAt"),
      ...pageWindow(query),
    }),
    prisma.purchaseShipment.count({ where }),
  ]);
  return paginated(
    rows.map((r) => toPurchaseListItemDto(r, visibility)),
    total,
    query,
  );
}

export async function getPurchase(id: string, visibility: Visibility) {
  const row = await prisma.purchaseShipment.findUnique({ where: { id }, include: purchaseDetailInclude });
  if (!row) throw notFound("Purchase");
  return toPurchaseDetailDto(row, visibility);
}

/** The most recent rate used for a currency, offered as a starting point — never applied automatically. */
export async function lastExchangeRate(currency: string) {
  const last = await prisma.purchaseShipment.findFirst({
    where: { currency, status: { not: "CANCELLED" } },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: { exchangeRate: true, code: true, invoiceDate: true },
  });
  return last ? { rate: last.exchangeRate.toString(), code: last.code, invoiceDate: fromDbDate(last.invoiceDate) } : null;
}

async function assertActiveSupplier(tx: Tx, id: string) {
  const supplier = await tx.supplier.findUnique({ where: { id } });
  if (!supplier?.isActive)
    throw new ApiError(400, "INVALID_SUPPLIER", "Choose an active supplier", {
      fieldErrors: { supplierId: ["Choose an active supplier"] },
    });
}

function draftData(input: PurchaseDraftInput) {
  const rate = dec(input.exchangeRate);
  return {
    header: {
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber ?? null,
      shipmentRef: input.shipmentRef ?? null,
      invoiceDate: toDbDate(input.invoiceDate),
      currency: input.currency,
      exchangeRate: rate,
      allocationMethod: input.allocationMethod,
      locationId: input.locationId,
      notes: input.notes ?? null,
    },
    lines: input.lines.map((l, position) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitPrice: dec(l.unitPrice),
      weightKg: l.weightKg ? dec(l.weightKg) : null,
      cbm: l.cbm ? dec(l.cbm) : null,
      position,
    })),
    charges: input.charges.map((c) => ({
      type: c.type,
      description: c.description ?? null,
      amount: dec(c.amount),
      currency: c.currency,
      amountInr: chargeToInr(dec(c.amount), c.currency, rate),
      isRecoverableTax: c.isRecoverableTax,
    })),
  };
}

async function validateDraftReferences(tx: Tx, input: PurchaseDraftInput) {
  await assertActiveSupplier(tx, input.supplierId);
  await assertActiveLocations(tx, [input.locationId]);
  await assertSellableVariants(
    tx,
    input.lines.map((l) => l.variantId),
  );
  // Fail early with a clear message rather than at receipt.
  previewLandedCost(input);
}

const draftSummary = (input: PurchaseDraftInput) => ({
  supplierId: input.supplierId,
  invoiceNumber: input.invoiceNumber,
  currency: input.currency,
  exchangeRate: input.exchangeRate,
  allocationMethod: input.allocationMethod,
  lines: input.lines.length,
  charges: input.charges.length,
});

export async function createDraft(input: PurchaseDraftInput, ctx: RequestContext, visibility: Visibility) {
  return withTransaction(async (tx) => {
    await validateDraftReferences(tx, input);
    const { header, lines, charges } = draftData(input);
    const purchase = await tx.purchaseShipment.create({
      data: {
        ...header,
        code: await nextCode(tx, "PUR"),
        createdById: ctx.userId,
        lines: { createMany: { data: lines } },
        charges: { createMany: { data: charges } },
      },
    });
    await recordAudit(tx, ctx, {
      action: "purchase.created",
      entity: "PurchaseShipment",
      entityId: purchase.id,
      after: { code: purchase.code, ...draftSummary(input) },
    });
    return toPurchaseDetailDto(
      await tx.purchaseShipment.findUniqueOrThrow({ where: { id: purchase.id }, include: purchaseDetailInclude }),
      visibility,
    );
  });
}

/** Locks the purchase row so receiving, editing and cancelling can't interleave. */
async function lockPurchase(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "PurchaseShipment" WHERE id = ${id} FOR UPDATE`;
  const purchase = await tx.purchaseShipment.findUnique({ where: { id }, include: { lines: true, charges: true } });
  if (!purchase) throw notFound("Purchase");
  return purchase;
}

const notDraft = (code: string, status: string) =>
  new ApiError(
    409,
    "PURCHASE_LOCKED",
    `${code} is ${status.toLowerCase()} and can no longer be edited. Use a cost adjustment or a return instead.`,
  );

export async function updateDraft(id: string, input: PurchaseDraftInput, ctx: RequestContext, visibility: Visibility) {
  return withTransaction(async (tx) => {
    const before = await lockPurchase(tx, id);
    if (before.status !== "DRAFT") throw notDraft(before.code, before.status);
    await validateDraftReferences(tx, input);

    const { header, lines, charges } = draftData(input);
    await tx.purchaseLine.deleteMany({ where: { shipmentId: id } });
    await tx.shipmentCharge.deleteMany({ where: { shipmentId: id } });
    await tx.purchaseShipment.update({
      where: { id },
      data: { ...header, lines: { createMany: { data: lines } }, charges: { createMany: { data: charges } } },
    });
    await recordAudit(tx, ctx, {
      action: "purchase.updated",
      entity: "PurchaseShipment",
      entityId: id,
      before: {
        lines: before.lines.length,
        charges: before.charges.length,
        exchangeRate: before.exchangeRate.toString(),
        currency: before.currency,
      },
      after: draftSummary(input),
    });
    return toPurchaseDetailDto(await tx.purchaseShipment.findUniqueOrThrow({ where: { id }, include: purchaseDetailInclude }), visibility);
  });
}

export async function cancelDraft(id: string, ctx: RequestContext, visibility: Visibility) {
  return withTransaction(async (tx) => {
    const purchase = await lockPurchase(tx, id);
    if (purchase.status !== "DRAFT") throw notDraft(purchase.code, purchase.status);
    await tx.purchaseShipment.update({ where: { id }, data: { status: "CANCELLED" } });
    await recordAudit(tx, ctx, {
      action: "purchase.cancelled",
      entity: "PurchaseShipment",
      entityId: id,
      before: { status: "DRAFT" },
      after: { status: "CANCELLED" },
    });
    return toPurchaseDetailDto(await tx.purchaseShipment.findUniqueOrThrow({ where: { id }, include: purchaseDetailInclude }), visibility);
  });
}

/**
 * Freezes each line's landed cost and posts the PURCHASE stock document, all in
 * one transaction under a row lock — a double click or a second user can't
 * receive the same purchase twice.
 */
export async function receivePurchase(id: string, input: ReceivePurchaseInput, ctx: RequestContext, visibility: Visibility) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    const purchase = await lockPurchase(tx, id);
    if (purchase.status === "RECEIVED") throw new ApiError(409, "ALREADY_RECEIVED", `${purchase.code} has already been received`);
    if (purchase.status !== "DRAFT") throw notDraft(purchase.code, purchase.status);
    await assertActiveLocations(tx, [purchase.locationId]);
    await assertSellableVariants(
      tx,
      purchase.lines.map((l) => l.variantId),
    );

    const lines = [...purchase.lines].sort((a, b) => a.position - b.position);
    const landed = computeLandedCost({
      exchangeRate: dec(purchase.exchangeRate.toString()),
      method: purchase.allocationMethod,
      lines: lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: dec(l.unitPrice.toString()),
        weightKg: l.weightKg ? dec(l.weightKg.toString()) : null,
        cbm: l.cbm ? dec(l.cbm.toString()) : null,
      })),
      charges: purchase.charges.map((c) => ({ amountInr: dec(c.amountInr.toString()), isRecoverableTax: c.isRecoverableTax })),
    });

    for (const [i, line] of lines.entries()) {
      const r = landed.lines[i]!;
      await tx.purchaseLine.update({
        where: { id: line.id },
        data: { unitPriceInr: r.unitPriceInr, allocatedCharges: r.allocatedCharges, landedUnitCost: r.landedUnitCost },
      });
    }

    const document = await postStockDocument(tx, ctx, {
      type: "PURCHASE",
      businessDate,
      reason: `Purchase ${purchase.code}`,
      reference: purchase.invoiceNumber ?? purchase.shipmentRef,
      sourceType: "PURCHASE",
      sourceId: purchase.id,
      lines: lines.map((l, i) => ({
        variantId: l.variantId,
        locationId: purchase.locationId,
        bucket: "SELLABLE",
        quantity: l.quantity,
        cost: { kind: "receive", unitCost: landed.lines[i]!.landedUnitCost },
      })),
    });

    await tx.purchaseShipment.update({
      where: { id },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        receivedDate: businessDate,
        receivedById: ctx.userId,
        stockDocumentId: document.id,
      },
    });
    await recordAudit(tx, ctx, {
      action: "purchase.received",
      entity: "PurchaseShipment",
      entityId: id,
      after: {
        code: purchase.code,
        stockDocument: document.code,
        units: landed.totals.units,
        landedTotal: landed.totals.landedTotal.toFixed(2),
        inputTaxCredit: landed.totals.inputTaxCredit.toFixed(2),
      },
    });
    return toPurchaseDetailDto(await tx.purchaseShipment.findUniqueOrThrow({ where: { id }, include: purchaseDetailInclude }), visibility);
  });
}

/**
 * A charge that arrived after receipt. Its share for units still on hand raises
 * the stock value; the share for units already gone is cost of sales. Recoverable
 * tax is only recorded (as input tax credit), never capitalised.
 */
export async function addLateCharge(id: string, input: LateChargeInput, ctx: RequestContext, visibility: Visibility) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    const purchase = await lockPurchase(tx, id);
    if (purchase.status !== "RECEIVED")
      throw new ApiError(409, "NOT_RECEIVED", "Late charges apply to received purchases. Add it to the draft instead.");

    const method = input.allocationMethod ?? purchase.allocationMethod;
    const amount = dec(input.amountInr);
    const lines = [...purchase.lines].sort((a, b) => a.position - b.position);

    const adjustmentLines: { variantId: string; allocated: Decimal; toInventory: Decimal; toCostOfSales: Decimal }[] = [];
    if (!input.isRecoverableTax) {
      // VALUE splits on the INR price frozen at receipt (rate 1 on already-converted prices).
      const weights = allocationWeights(
        method,
        lines.map((l) => ({
          quantity: l.quantity,
          unitPrice: dec((l.unitPriceInr ?? l.unitPrice).toString()),
          weightKg: l.weightKg ? dec(l.weightKg.toString()) : null,
          cbm: l.cbm ? dec(l.cbm.toString()) : null,
        })),
        new Decimal(1),
      );
      const shares = allocate(amount, weights);
      for (const [i, line] of lines.entries()) {
        const share = shares[i]!;
        if (share.isZero()) continue;
        const onHand = await physicalStockOf(tx, { variantId: line.variantId });
        const stillHeld = share.mul(Math.min(onHand, line.quantity)).div(line.quantity).toDecimalPlaces(6);
        const toInventory = await revalueStock(tx, line.variantId, stillHeld);
        adjustmentLines.push({ variantId: line.variantId, allocated: share, toInventory, toCostOfSales: share.sub(toInventory) });
      }
    }

    const adjustment = await tx.costAdjustment.create({
      data: {
        code: await nextCode(tx, "CAJ"),
        shipmentId: id,
        type: input.type,
        description: input.description ?? null,
        amountInr: amount,
        isRecoverableTax: input.isRecoverableTax,
        allocationMethod: method,
        businessDate,
        createdById: ctx.userId,
        lines: { createMany: { data: adjustmentLines } },
      },
    });
    await recordAudit(tx, ctx, {
      action: "purchase.cost_adjusted",
      entity: "PurchaseShipment",
      entityId: id,
      after: {
        adjustment: adjustment.code,
        amountInr: amount.toFixed(2),
        isRecoverableTax: input.isRecoverableTax,
        toInventory: adjustmentLines.reduce((a, l) => a.add(l.toInventory), new Decimal(0)).toFixed(2),
        toCostOfSales: adjustmentLines.reduce((a, l) => a.add(l.toCostOfSales), new Decimal(0)).toFixed(2),
      },
    });
    return toPurchaseDetailDto(await tx.purchaseShipment.findUniqueOrThrow({ where: { id }, include: purchaseDetailInclude }), visibility);
  });
}

/** Sends goods back to the supplier; units leave at the current average cost. */
export async function returnToSupplier(id: string, input: PurchaseReturnInput, ctx: RequestContext, visibility: Visibility) {
  const businessDate = resolveBusinessDate(input.businessDate);
  return withTransaction(async (tx) => {
    const purchase = await lockPurchase(tx, id);
    if (purchase.status !== "RECEIVED") throw new ApiError(409, "NOT_RECEIVED", "Only received purchases can be returned");
    await assertActiveLocations(tx, [input.locationId]);

    const returned = await tx.purchaseReturnLine.groupBy({
      by: ["purchaseLineId"],
      where: { purchaseReturn: { shipmentId: id } },
      _sum: { quantity: true },
    });
    const returnedQty = new Map(returned.map((r) => [r.purchaseLineId, r._sum.quantity ?? 0]));

    const lines = input.lines.map((l, i) => {
      const line = purchase.lines.find((pl) => pl.id === l.purchaseLineId);
      if (!line) throw new ApiError(400, "INVALID_LINE", "An item doesn't belong to this purchase");
      const left = line.quantity - (returnedQty.get(line.id) ?? 0);
      if (l.quantity > left) {
        throw new ApiError(409, "RETURN_EXCEEDS_RECEIVED", `Only ${left} unit(s) of this item can still be returned`, {
          fieldErrors: { [`lines.${i}.quantity`]: [`At most ${left}`] },
        });
      }
      return { ...l, variantId: line.variantId };
    });

    const returnId = randomUUID();
    const document = await postStockDocument(tx, ctx, {
      type: "PURCHASE_RETURN",
      businessDate,
      reason: input.reason,
      reference: purchase.code,
      sourceType: "PURCHASE_RETURN",
      sourceId: returnId,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        locationId: input.locationId,
        bucket: input.bucket,
        quantity: -l.quantity,
        cost: { kind: "issue" },
      })),
    });
    const created = await tx.purchaseReturn.create({
      data: {
        id: returnId,
        code: await nextCode(tx, "PRT"),
        shipmentId: id,
        locationId: input.locationId,
        businessDate,
        reason: input.reason,
        stockDocumentId: document.id,
        createdById: ctx.userId,
        lines: {
          createMany: { data: lines.map((l) => ({ purchaseLineId: l.purchaseLineId, variantId: l.variantId, quantity: l.quantity })) },
        },
      },
    });
    await recordAudit(tx, ctx, {
      action: "purchase.returned",
      entity: "PurchaseShipment",
      entityId: id,
      after: { return: created.code, stockDocument: document.code, units: lines.reduce((a, l) => a + l.quantity, 0) },
    });
    return toPurchaseDetailDto(await tx.purchaseShipment.findUniqueOrThrow({ where: { id }, include: purchaseDetailInclude }), visibility);
  });
}
