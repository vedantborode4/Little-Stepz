import type { Prisma } from "@repo/crm-db/client";
import type { OrderProfitDto, SaleTotalsDto, SalesOrderDetailDto, SalesOrderListItemDto } from "@repo/crm-schema";
import { fromDbDate } from "../../core/dates";
import { Decimal, money } from "../../core/money";

export interface Visibility {
  costs: boolean;
}

export const orderListInclude = {
  customer: { select: { id: true, code: true, name: true } },
  lines: { select: { quantity: true } },
} satisfies Prisma.SalesOrderInclude;

export const orderDetailInclude = {
  customer: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  stockDocument: { select: { id: true, code: true } },
  lines: {
    include: {
      variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
      reservation: { select: { quantity: true, releasedAt: true } },
    },
    orderBy: { position: "asc" },
  },
  events: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SalesOrderInclude;

type ListRow = Prisma.SalesOrderGetPayload<{ include: typeof orderListInclude }>;
type DetailRow = Prisma.SalesOrderGetPayload<{ include: typeof orderDetailInclude }>;

const dec = (v: Prisma.Decimal) => new Decimal(v.toString());

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
 * Profit over lines whose cost is fully known. A line with any unknown-cost unit
 * is left out of the margin (and counted) rather than given an invented cost.
 * Shipping charged is revenue with no cost of goods.
 */
export function orderProfit(o: DetailRow): OrderProfitDto | null {
  if (!o.fulfilledAt) return null;
  const known = o.lines.filter((l) => l.cogs !== null && l.unknownCostQty === 0);
  const lineTaxable = o.lines.reduce((s, l) => s.add(dec(l.taxableValue)), new Decimal(0));
  const shippingTaxable = dec(o.taxableTotal).sub(lineTaxable);
  const netSales = known.reduce((s, l) => s.add(dec(l.taxableValue)), shippingTaxable);
  const gross = known.reduce((s, l) => s.add(dec(l.lineTotal)), dec(o.shippingCharged));
  const cogs = known.reduce((s, l) => s.add(dec(l.cogs!)), new Decimal(0));
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
      reservedQty: l.reservation && !l.reservation.releasedAt ? l.reservation.quantity : 0,
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
  };
  if (visibility.costs) dto.profit = orderProfit(o);
  return dto;
}
