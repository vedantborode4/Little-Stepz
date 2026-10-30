import { randomUUID } from "crypto";
import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type { CreateReturnInput, ReturnListQuery, ReturnPreviewDto, ReturnPreviewInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { resolveBusinessDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, forbidden, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec, Decimal, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertActiveLocations } from "../inventory/inventory.service";
import { postStockDocument, type EngineLine } from "../inventory/stock-engine";
import { giveBack } from "../payments/ledger";
import { addEvent } from "../sales/sales.service";
import { refundDue, returnLineAmounts, shippingRefundAmounts } from "./return-maths";
import { returnDetailInclude, returnListInclude, toReturnDto, toReturnListItemDto } from "./returns.mappers";

export interface ReturnRights {
  /** Money back as a refund payment (credit only needs return rights). */
  refund: boolean;
  costs: boolean;
}

type Db = Tx | typeof prisma;
const d = (v: Prisma.Decimal | null | undefined) => new Decimal((v ?? 0).toString());

const orderForReturn = (db: Db, orderId: string) =>
  db.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      lines: {
        include: {
          variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
          returnLines: { select: { quantity: true, amount: true, taxableValue: true, cogs: true, unknownCostQty: true } },
        },
      },
      returns: { select: { amount: true, shippingRefund: true } },
      allocations: { select: { amount: true } },
    },
  });

/** Everything a return of these lines would do, without saving: shared by the preview and the real thing. */
async function planReturn(db: Db, orderId: string, input: ReturnPreviewInput) {
  const order = await orderForReturn(db, orderId);
  if (!order) throw notFound("Order");
  if (!order.fulfilledAt) {
    throw new ApiError(409, "NOT_FULFILLED", `${order.code} hasn't left stock yet; cancel it instead of returning items`);
  }
  const byId = new Map(order.lines.map((l) => [l.id, l]));
  const lines = input.lines.map((req) => {
    const line = byId.get(req.orderLineId);
    if (!line) throw new ApiError(400, "INVALID_LINE", "That item isn't on this order");
    const prior = {
      quantity: line.returnLines.reduce((s, r) => s + r.quantity, 0),
      amount: line.returnLines.reduce((s, r) => s.add(d(r.amount)), new Decimal(0)),
      taxableValue: line.returnLines.reduce((s, r) => s.add(d(r.taxableValue)), new Decimal(0)),
      cogs: line.returnLines.reduce((s, r) => s.add(d(r.cogs)), new Decimal(0)),
      knownQty: line.returnLines.reduce((s, r) => s + r.quantity - r.unknownCostQty, 0),
    };
    const amounts = returnLineAmounts(
      {
        sku: line.variant.sku,
        quantity: line.quantity,
        lineTotal: d(line.lineTotal),
        taxableValue: d(line.taxableValue),
        cogs: line.cogs ? d(line.cogs) : null,
        unknownCostQty: line.unknownCostQty,
      },
      prior,
      req.quantity,
    );
    return { line, quantity: req.quantity, condition: req.condition, ...amounts };
  });

  const lineTaxable = order.lines.reduce((s, l) => s.add(d(l.taxableValue)), new Decimal(0));
  const shipping = shippingRefundAmounts(
    dec(input.shippingRefund),
    d(order.shippingCharged),
    d(order.taxableTotal).sub(lineTaxable),
    order.returns.reduce((s, r) => s.add(d(r.shippingRefund)), new Decimal(0)),
  );

  const amount = lines.reduce((s, l) => s.add(l.amount), shipping.amount);
  const taxableValue = lines.reduce((s, l) => s.add(l.taxableValue), shipping.taxableValue);
  const returnedBefore = order.returns.reduce((s, r) => s.add(d(r.amount)), new Decimal(0));
  const netValueAfter = d(order.grandTotal).sub(returnedBefore).sub(amount);
  const paid = order.allocations.reduce((s, a) => s.add(d(a.amount)), new Decimal(0));
  return {
    order,
    lines,
    shipping,
    amount,
    taxableValue,
    gstAmount: amount.sub(taxableValue),
    netValueAfter,
    paid,
    refund: refundDue(paid, netValueAfter),
  };
}

type Plan = Awaited<ReturnType<typeof planReturn>>;

function planDto(plan: Plan, costs: boolean): ReturnPreviewDto {
  return {
    lines: plan.lines.map((l) => ({
      orderLineId: l.line.id,
      variantId: l.line.variantId,
      sku: l.line.variant.sku,
      productName: l.line.variant.product.name,
      variantName: l.line.variant.name,
      quantity: l.quantity,
      condition: l.condition,
      amount: money(l.amount),
      taxableValue: money(l.taxableValue),
      gstAmount: money(l.gstAmount),
      ...(costs && { cogs: money(l.cogs), unknownCostQty: l.unknownCostQty }),
    })),
    shippingRefund: money(plan.shipping.amount),
    amount: money(plan.amount),
    taxableValue: money(plan.taxableValue),
    gstAmount: money(plan.gstAmount),
    netValueAfter: money(plan.netValueAfter),
    paid: money(plan.paid),
    refundDue: money(plan.refund),
  };
}

export async function previewReturn(orderId: string, input: ReturnPreviewInput, rights: ReturnRights) {
  return planDto(await planReturn(prisma, orderId, input), rights.costs);
}

/**
 * Resellable units go back to sellable stock and damaged ones to the damaged
 * bucket, both at the cost they left at (so the average isn't disturbed);
 * written-off units don't come back and their cost stays a loss.
 */
function restockLines(plan: Plan, locationId: string): EngineLine[] {
  return plan.lines
    .filter((l) => l.condition !== "WRITE_OFF")
    .flatMap((l): EngineLine[] => {
      const bucket = l.condition === "RESELLABLE" ? "SELLABLE" : "DAMAGED";
      const base = { variantId: l.line.variantId, locationId, bucket } as const;
      const parts: EngineLine[] = [];
      if (l.knownQty > 0) {
        parts.push({ ...base, quantity: l.knownQty, cost: { kind: "receive", unitCost: l.cogs.div(l.knownQty).toDecimalPlaces(6) } });
      }
      if (l.unknownCostQty > 0) parts.push({ ...base, quantity: l.unknownCostQty, cost: { kind: "receive", unitCost: null } });
      return parts;
    });
}

export async function createReturn(orderId: string, input: CreateReturnInput, ctx: RequestContext, rights: ReturnRights) {
  const id = await withTransaction(async (tx) => {
    // The order row is the lock: two returns on one order can't both take its last units.
    await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${orderId} FOR UPDATE`;
    const plan = await planReturn(tx, orderId, input);
    const { order } = plan;
    const locationId = input.locationId ?? order.locationId;
    await assertActiveLocations(tx, [locationId]);
    const businessDate = resolveBusinessDate(input.businessDate);
    const returnId = randomUUID();
    const code = await nextCode(tx, "RET", 5);

    let links: { paymentId: string | null; creditEntryId: string | null } = { paymentId: null, creditEntryId: null };
    if (plan.refund.gt(0)) {
      if (!input.refund) {
        throw new ApiError(
          409,
          "REFUND_CHOICE_REQUIRED",
          `${money(plan.refund)} must go back to the customer. Refund it or keep it as credit.`,
          {
            refundDue: money(plan.refund),
          },
        );
      }
      if (input.refund.method === "REFUND" && !rights.refund) throw forbidden("Only admins can pay refunds; keep it as credit instead");
      const settlement =
        input.refund.method === "CREDIT"
          ? { mode: "CREDIT" as const }
          : { mode: "REFUND" as const, accountId: input.refund.accountId, reference: input.refund.reference };
      links = await giveBack(tx, ctx, order, plan.refund, settlement, "RETURN", `Refund for return ${code} of ${order.code}`);
    }

    const stockLines = restockLines(plan, locationId);
    const document = stockLines.length
      ? await postStockDocument(tx, ctx, {
          type: "SALE_RETURN",
          businessDate,
          reason: `Return ${code} of ${order.code}: ${input.reason}`,
          reference: order.code,
          sourceType: "SALE_RETURN",
          sourceId: returnId,
          lines: stockLines,
        })
      : null;

    await tx.salesReturn.create({
      data: {
        id: returnId,
        code,
        orderId,
        locationId,
        businessDate,
        reason: input.reason,
        amount: plan.amount,
        taxableValue: plan.taxableValue,
        gstAmount: plan.gstAmount,
        shippingRefund: plan.shipping.amount,
        refundMethod: plan.refund.gt(0) ? input.refund!.method : "NONE",
        refundAmount: plan.refund,
        paymentId: links.paymentId,
        creditEntryId: links.creditEntryId,
        stockDocumentId: document?.id ?? null,
        createdById: ctx.userId,
        lines: {
          createMany: {
            data: plan.lines.map((l) => ({
              orderLineId: l.line.id,
              variantId: l.line.variantId,
              quantity: l.quantity,
              condition: l.condition,
              amount: l.amount,
              taxableValue: l.taxableValue,
              gstAmount: l.gstAmount,
              cogs: l.cogs,
              unknownCostQty: l.unknownCostQty,
            })),
          },
        },
      },
    });
    await addEvent(
      tx,
      ctx,
      orderId,
      "returned",
      null,
      `${code}: ${plan.lines.reduce((s, l) => s + l.quantity, 0)} item(s), ${money(plan.amount)}`,
    );
    await recordAudit(tx, ctx, {
      action: "return.created",
      entity: "SalesReturn",
      entityId: returnId,
      after: { code, order: order.code, amount: money(plan.amount), refund: money(plan.refund), reason: input.reason },
    });
    return returnId;
  });
  return getReturn(id, rights.costs);
}

export async function getReturn(id: string, costs: boolean) {
  const row = await prisma.salesReturn.findUnique({ where: { id }, include: returnDetailInclude });
  if (!row) throw notFound("Return");
  return toReturnDto(row, costs);
}

export async function listReturns(query: ReturnListQuery) {
  const where: Prisma.SalesReturnWhereInput = {
    order: query.customerId ? { customerId: query.customerId } : undefined,
    businessDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { reason: { contains: query.q, mode: "insensitive" } },
        { order: { code: { contains: query.q, mode: "insensitive" } } },
        { order: { customer: { name: { contains: query.q, mode: "insensitive" } } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.salesReturn.findMany({
      where,
      include: returnListInclude,
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      ...pageWindow(query),
    }),
    prisma.salesReturn.count({ where }),
  ]);
  return paginated(rows.map(toReturnListItemDto), total, query);
}
