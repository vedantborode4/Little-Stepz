import { prisma, type Prisma } from "@repo/crm-db/client";
import type { SalesSummaryDto, SalesSummaryQuery } from "@repo/crm-schema";
import { toDbDate } from "../../core/dates";
import { Decimal, money } from "../../core/money";
import type { Visibility } from "./sales.mappers";

const d = (v: Prisma.Decimal | null | undefined) => new Decimal((v ?? 0).toString());

/**
 * Sales recognised in a period: orders fulfilled (handed over or dispatched) on
 * those IST dates. Money taken for orders not yet fulfilled is an advance and
 * never appears here. Profit only covers lines whose cost is fully known.
 */
export async function salesSummary(query: SalesSummaryQuery, visibility: Visibility): Promise<SalesSummaryDto> {
  const where: Prisma.SalesOrderWhereInput = {
    fulfilledAt: { not: null },
    fulfilledDate: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
  };
  const [orders, byChannel, lines] = await Promise.all([
    prisma.salesOrder.aggregate({
      where,
      _count: true,
      _sum: { grandTotal: true, taxableTotal: true, gstTotal: true, lineDiscounts: true, orderDiscount: true },
    }),
    prisma.salesOrder.groupBy({ by: ["channel"], where, _count: true, _sum: { grandTotal: true }, orderBy: { channel: "asc" } }),
    prisma.salesOrderLine.aggregate({ where: { order: where }, _sum: { quantity: true, taxableValue: true, unknownCostQty: true } }),
  ]);

  const summary: SalesSummaryDto = {
    from: query.from,
    to: query.to,
    orders: orders._count,
    units: lines._sum.quantity ?? 0,
    grossSales: money(d(orders._sum.grandTotal)),
    netSales: money(d(orders._sum.taxableTotal)),
    gst: money(d(orders._sum.gstTotal)),
    discounts: money(d(orders._sum.lineDiscounts).add(d(orders._sum.orderDiscount))),
    byChannel: byChannel.map((c) => ({ channel: c.channel, orders: c._count, grossSales: money(d(c._sum.grandTotal)) })),
  };

  if (visibility.costs) {
    const known = await prisma.salesOrderLine.aggregate({
      where: { order: where, unknownCostQty: 0 },
      _sum: { taxableValue: true, cogs: true },
    });
    const shippingTaxable = d(orders._sum.taxableTotal).sub(d(lines._sum.taxableValue));
    const cogs = d(known._sum.cogs);
    summary.cogs = money(cogs);
    summary.grossProfit = money(d(known._sum.taxableValue).add(shippingTaxable).sub(cogs));
    summary.unknownCostUnits = lines._sum.unknownCostQty ?? 0;
  }
  return summary;
}
