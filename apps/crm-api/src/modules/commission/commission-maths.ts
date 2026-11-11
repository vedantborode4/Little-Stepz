import { Decimal, round2 } from "../../core/money";

export interface CommissionReturn {
  id: string;
  code: string;
  businessDate: string;
  createdAt: Date;
  /** Goods value excluding GST that came back (shipping refunds never count). */
  taxable: Decimal;
}

export interface CommissionOrder {
  id: string;
  code: string;
  salespersonId: string;
  rate: Decimal;
  /** Null until handed over or dispatched; such a sale has earned nothing yet. */
  fulfilledDate: string | null;
  /** Σ line taxable values: the goods value excluding GST, after discounts, without shipping. */
  goodsTaxable: Decimal;
  returns: CommissionReturn[];
}

export interface CommissionEntry {
  kind: "SALE" | "RETURN";
  date: string;
  salespersonId: string;
  order: { id: string; code: string };
  salesReturn: { id: string; code: string } | null;
  rate: Decimal;
  /** Goods value excluding GST; negative for a return. */
  base: Decimal;
  /** Negative for a return. */
  commission: Decimal;
}

/**
 * A sale earns rate × its goods value on the day it was fulfilled; each return
 * takes back the commission on what came back, on the return's day. Returns are
 * worked out on the running total returned, so a sale returned in full (in one
 * go or several) nets to exactly zero with no paise left over from rounding.
 */
export function commissionEntries(order: CommissionOrder): CommissionEntry[] {
  if (!order.fulfilledDate) return [];
  const pct = order.rate.div(100);
  const ref = { id: order.id, code: order.code };
  const entries: CommissionEntry[] = [
    {
      kind: "SALE",
      date: order.fulfilledDate,
      salespersonId: order.salespersonId,
      order: ref,
      salesReturn: null,
      rate: order.rate,
      base: order.goodsTaxable,
      commission: round2(order.goodsTaxable.mul(pct)),
    },
  ];

  const returns = [...order.returns].sort(
    (a, b) => a.businessDate.localeCompare(b.businessDate) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let returned = new Decimal(0);
  let takenBack = new Decimal(0);
  for (const r of returns) {
    if (r.taxable.isZero()) continue;
    returned = returned.add(r.taxable);
    const total = round2(returned.mul(pct));
    entries.push({
      kind: "RETURN",
      date: r.businessDate,
      salespersonId: order.salespersonId,
      order: ref,
      salesReturn: { id: r.id, code: r.code },
      rate: order.rate,
      base: r.taxable.neg(),
      commission: total.sub(takenBack).neg(),
    });
    takenBack = total;
  }
  return entries;
}

export interface CommissionTotals {
  sales: number;
  salesValue: Decimal;
  earned: Decimal;
  /** Commission taken back by returns, as a positive amount. */
  returned: Decimal;
  net: Decimal;
}

export function totalEntries(entries: CommissionEntry[]): CommissionTotals {
  const totals = { sales: 0, salesValue: new Decimal(0), earned: new Decimal(0), returned: new Decimal(0), net: new Decimal(0) };
  for (const e of entries) {
    if (e.kind === "SALE") {
      totals.sales += 1;
      totals.salesValue = totals.salesValue.add(e.base);
      totals.earned = totals.earned.add(e.commission);
    } else {
      totals.returned = totals.returned.sub(e.commission);
    }
    totals.net = totals.net.add(e.commission);
  }
  return totals;
}
