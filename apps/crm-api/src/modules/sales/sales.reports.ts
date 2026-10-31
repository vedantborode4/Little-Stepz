import { prisma, type Prisma } from "@repo/crm-db/client";
import type { SalesSummaryDto, SalesSummaryQuery } from "@repo/crm-schema";
import { toDbDate } from "../../core/dates";
import { decOrZero, money } from "../../core/money";
import type { Visibility } from "./sales.mappers";

/**
 * Sales recognised in a period: orders fulfilled (handed over or dispatched) on
 * those IST dates, less returns dated in the period. Money taken for orders not
 * yet fulfilled is an advance and never appears here. Profit only covers lines
 * whose cost is fully known; returned units take their revenue back, and their
 * cost too unless they were written off.
 */
export async function salesSummary(query: SalesSummaryQuery, visibility: Visibility): Promise<SalesSummaryDto> {
  const range = { gte: toDbDate(query.from), lte: toDbDate(query.to) };
  const where: Prisma.SalesOrderWhereInput = { fulfilledAt: { not: null }, fulfilledDate: range };
  const [orders, byChannel, lines, returns, returnLines] = await Promise.all([
    prisma.salesOrder.aggregate({
      where,
      _count: true,
      _sum: { grandTotal: true, taxableTotal: true, gstTotal: true, lineDiscounts: true, orderDiscount: true },
    }),
    prisma.salesOrder.groupBy({ by: ["channel"], where, _count: true, _sum: { grandTotal: true }, orderBy: { channel: "asc" } }),
    prisma.salesOrderLine.aggregate({ where: { order: where }, _sum: { quantity: true, taxableValue: true, unknownCostQty: true } }),
    prisma.salesReturn.aggregate({
      where: { businessDate: range },
      _count: true,
      _sum: { amount: true, taxableValue: true, gstAmount: true },
    }),
    prisma.salesReturnLine.aggregate({ where: { salesReturn: { businessDate: range } }, _sum: { quantity: true, taxableValue: true } }),
  ]);

  const summary: SalesSummaryDto = {
    from: query.from,
    to: query.to,
    orders: orders._count,
    units: (lines._sum.quantity ?? 0) - (returnLines._sum.quantity ?? 0),
    grossSales: money(decOrZero(orders._sum.grandTotal)),
    netSales: money(decOrZero(orders._sum.taxableTotal).sub(decOrZero(returns._sum.taxableValue))),
    gst: money(decOrZero(orders._sum.gstTotal).sub(decOrZero(returns._sum.gstAmount))),
    discounts: money(decOrZero(orders._sum.lineDiscounts).add(decOrZero(orders._sum.orderDiscount))),
    returns: money(decOrZero(returns._sum.amount)),
    returnsCount: returns._count,
    byChannel: byChannel.map((c) => ({ channel: c.channel, orders: c._count, grossSales: money(decOrZero(c._sum.grandTotal)) })),
  };

  if (visibility.costs) {
    const knownReturn = {
      salesReturn: { businessDate: range },
      orderLine: { unknownCostQty: 0 },
    } satisfies Prisma.SalesReturnLineWhereInput;
    const [known, returnedKnown, restocked] = await Promise.all([
      prisma.salesOrderLine.aggregate({ where: { order: where, unknownCostQty: 0 }, _sum: { taxableValue: true, cogs: true } }),
      prisma.salesReturnLine.aggregate({ where: knownReturn, _sum: { taxableValue: true } }),
      prisma.salesReturnLine.aggregate({ where: { ...knownReturn, condition: { not: "WRITE_OFF" } }, _sum: { cogs: true } }),
    ]);
    const shippingTaxable = decOrZero(orders._sum.taxableTotal).sub(decOrZero(lines._sum.taxableValue));
    const shippingRefundTaxable = decOrZero(returns._sum.taxableValue).sub(decOrZero(returnLines._sum.taxableValue));
    const netKnownSales = decOrZero(known._sum.taxableValue)
      .add(shippingTaxable)
      .sub(decOrZero(returnedKnown._sum.taxableValue))
      .sub(shippingRefundTaxable);
    const cogs = decOrZero(known._sum.cogs).sub(decOrZero(restocked._sum.cogs));
    summary.cogs = money(cogs);
    summary.grossProfit = money(netKnownSales.sub(cogs));
    summary.unknownCostUnits = lines._sum.unknownCostQty ?? 0;
  }
  return summary;
}
