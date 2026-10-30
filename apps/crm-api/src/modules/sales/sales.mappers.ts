import type { Prisma } from "@repo/crm-db/client";
import type { OrderProfitDto, SaleTotalsDto, SalesOrderDetailDto, SalesOrderListItemDto } from "@repo/crm-schema";
import { fromDbDate } from "../../core/dates";
import { Decimal, money } from "../../core/money";
import { paymentStatus } from "../payments/ledger";
import { returnListInclude, toReturnListItemDto } from "../returns/returns.mappers";

export interface Visibility {
  costs: boolean;
}

export const orderListInclude = {
  customer: { select: { id: true, code: true, name: true } },
  lines: { select: { quantity: true } },
  allocations: { select: { amount: true } },
  returns: { select: { amount: true } },
} satisfies Prisma.SalesOrderInclude;

export const orderDetailInclude = {
  customer: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  stockDocument: { select: { id: true, code: true } },
  lines: {
    include: {
      variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
      reservations: { where: { releasedAt: null }, select: { quantity: true } },
      returnLines: { select: { quantity: true, amount: true, taxableValue: true, cogs: true, condition: true } },
    },
    orderBy: { position: "asc" },
  },
  events: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
  allocations: {
    include: {
      payment: { select: { id: true, code: true, businessDate: true, method: true, reference: true, account: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  },
  returns: { include: { ...returnListInclude, lines: { select: { quantity: true, taxableValue: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SalesOrderInclude;

type ListRow = Prisma.SalesOrderGetPayload<{ include: typeof orderListInclude }>;
type DetailRow = Prisma.SalesOrderGetPayload<{ include: typeof orderDetailInclude }>;

const dec = (v: Prisma.Decimal) => new Decimal(v.toString());
const sum = <T>(rows: T[], pick: (r: T) => Prisma.Decimal) => rows.reduce((s, r) => s.add(dec(pick(r))), new Decimal(0));

/** Paid, due and status against the order's net value (total less returns), from its signed allocations. */
function paymentState(o: { grandTotal: Prisma.Decimal; allocations: { amount: Prisma.Decimal }[]; returns: { amount: Prisma.Decimal }[] }) {
  const returned = sum(o.returns, (r) => r.amount);
  const net = dec(o.grandTotal).sub(returned);
  const paid = sum(o.allocations, (a) => a.amount);
  const refunded = o.allocations.some((a) => dec(a.amount).isNegative());
  return {
    returned: money(returned),
    paid: money(paid),
    due: money(Decimal.max(net.sub(paid), 0)),
    paymentStatus: paymentStatus(net, paid, refunded),
  };
}

export const toOrderListItemDto = (o: ListRow): SalesOrderListItemDto => ({
  id: o.id,
  code: o.code,
  type: o.type,
  channel: o.channel,
  fulfilment: o.fulfilment,
  status: o.status,
  customer: o.customer,
  orderDate: fromDbDate(o.orderDate),
  units: o.lines.reduce((s, l) => s + l.quantity, 0),
  grandTotal: money(o.grandTotal),
  ...paymentState(o),
  fulfilledAt: o.fulfilledAt?.toISOString() ?? null,
  createdAt: o.createdAt.toISOString(),
});

export function toTotalsDto(o: DetailRow): SaleTotalsDto {
  return {
    units: o.lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: money(o.subtotal),
    lineDiscounts: money(o.lineDiscounts),
    orderDiscount: money(o.orderDiscount),
    shippingCharged: money(o.shippingCharged),
    grandTotal: money(o.grandTotal),
    taxableTotal: money(o.taxableTotal),
    gstTotal: money(o.gstTotal),
  };
}

/**
 * Profit over lines whose cost is fully known, net of returns. A line with any
 * unknown-cost unit is left out of the margin (and counted) rather than given an
 * invented cost. Returned units take their revenue back; their cost comes back
 * too unless they were written off, which stays a loss. Shipping charged is
 * revenue with no cost of goods.
 */
export function orderProfit(o: DetailRow): OrderProfitDto | null {
  if (!o.fulfilledAt) return null;
  const known = o.lines.filter((l) => l.cogs !== null && l.unknownCostQty === 0);
  const restocked = (l: DetailRow["lines"][number]) => l.returnLines.filter((r) => r.condition !== "WRITE_OFF");

  const lineTaxable = sum(o.lines, (l) => l.taxableValue);
  const shippingTaxable = dec(o.taxableTotal).sub(lineTaxable);
  const shippingRefundTaxable = o.returns.reduce(
    (s, r) => s.add(dec(r.taxableValue)).sub(sum(r.lines, (x) => x.taxableValue)),
    new Decimal(0),
  );
  const shippingRefund = sum(o.returns, (r) => r.shippingRefund);

  const netSales = known.reduce(
    (s, l) => s.add(dec(l.taxableValue)).sub(sum(l.returnLines, (r) => r.taxableValue)),
    shippingTaxable.sub(shippingRefundTaxable),
  );
  const gross = known.reduce(
    (s, l) => s.add(dec(l.lineTotal)).sub(sum(l.returnLines, (r) => r.amount)),
    dec(o.shippingCharged).sub(shippingRefund),
  );
  const cogs = known.reduce((s, l) => s.add(dec(l.cogs!)).sub(sum(restocked(l), (r) => r.cogs)), new Decimal(0));
  const grossProfit = netSales.sub(cogs);
  return {
    netSales: money(netSales),
    cogs: money(cogs),
    grossProfit: money(grossProfit),
    marginPercent: netSales.isZero() ? null : grossProfit.div(netSales).mul(100).toFixed(1),
    profitBeforeGst: money(gross.sub(cogs)),
    unknownCostUnits: o.lines.reduce((s, l) => s + l.unknownCostQty, 0),
  };
}

export function toOrderDetailDto(o: DetailRow, visibility: Visibility): SalesOrderDetailDto {
  const dto: SalesOrderDetailDto = {
    ...toOrderListItemDto({ ...o, lines: o.lines }),
    location: o.location,
    customerName: o.customerName,
    dueDate: o.dueDate ? fromDbDate(o.dueDate) : null,
    expectedArrival: o.expectedArrival ? fromDbDate(o.expectedArrival) : null,
    isInterState: o.isInterState,
    externalRef: o.externalRef,
    notes: o.notes,
    confirmedAt: o.confirmedAt?.toISOString() ?? null,
    fulfilledDate: o.fulfilledDate ? fromDbDate(o.fulfilledDate) : null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    createdByName: o.createdBy?.name ?? null,
    stockDocument: o.stockDocument,
    totals: toTotalsDto(o),
    lines: o.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      sku: l.variant.sku,
      productName: l.variant.product.name,
      variantName: l.variant.name,
      quantity: l.quantity,
      regularPrice: money(l.regularPrice),
      unitPrice: money(l.unitPrice),
      priceSource: l.priceSource,
      lineDiscount: money(l.lineDiscount),
      orderDiscountShare: money(l.orderDiscountShare),
      lineTotal: money(l.lineTotal),
      gstRate: l.gstRate.toString(),
      taxableValue: money(l.taxableValue),
      gstAmount: money(l.gstAmount),
      reservedQty: l.reservations[0]?.quantity ?? 0,
      returnedQty: l.returnLines.reduce((s, r) => s + r.quantity, 0),
      ...(visibility.costs && { cogs: l.cogs ? money(dec(l.cogs)) : null, unknownCostQty: l.unknownCostQty }),
    })),
    events: o.events.map((e) => ({
      id: e.id,
      action: e.action,
      status: e.status,
      note: e.note,
      userName: e.createdBy?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    payments: o.allocations.map((a) => ({
      id: a.id,
      source: a.payment ? ("PAYMENT" as const) : ("CREDIT" as const),
      paymentId: a.payment?.id ?? null,
      code: a.payment?.code ?? null,
      businessDate: a.payment ? fromDbDate(a.payment.businessDate) : a.createdAt.toISOString().slice(0, 10),
      method: a.payment?.method ?? null,
      accountName: a.payment?.account.name ?? null,
      reference: a.payment?.reference ?? null,
      amount: money(a.amount),
    })),
    allocated: o.lines.length > 0 && o.lines.every((l) => l.reservations.length > 0),
    returns: o.returns.map(toReturnListItemDto),
  };
  if (visibility.costs) dto.profit = orderProfit(o);
  return dto;
}
