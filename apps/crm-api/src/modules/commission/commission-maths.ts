import { Decimal, round2 } from "../../core/money";

/** A sold line as it was frozen at sale and at deduction. */
export interface CommissionLine {
  id: string;
  quantity: number;
  /** Goods value excluding GST, after discounts. */
  taxable: Decimal;
  /** Cost of the units that left with a known cost. */
  cogs: Decimal;
  /** Units that left with no known cost: they earn nothing. */
  unknownCostQty: number;
}

export interface CommissionReturnLine {
  orderLineId: string;
  quantity: number;
  /** Cost of the returned units with a known cost (they come back first). */
  cogs: Decimal;
  unknownCostQty: number;
}

export interface CommissionReturn {
  id: string;
  code: string;
  businessDate: string;
  createdAt: Date;
  lines: CommissionReturnLine[];
}

export interface CommissionOrder {
  id: string;
  code: string;
  salespersonId: string;
  rate: Decimal;
  /** Null until handed over or dispatched; such a sale has earned nothing yet. */
  fulfilledDate: string | null;
  lines: CommissionLine[];
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
  value: Decimal;
  /** Gross profit on units with a known cost; negative for a return. */
  profit: Decimal;
  /** Negative for a return. */
  commission: Decimal;
  /** Units without a known cost, which earn nothing (or come back without taking anything). */
  costMissingUnits: number;
}

interface Returned {
  qty: number;
  knownQty: number;
  cogs: Decimal;
}

const NONE: Returned = { qty: 0, knownQty: 0, cogs: new Decimal(0) };

/**
 * What a line still has after `returned`: its goods value, and its gross profit
 * on the units with a known cost (unit price × known units still out − their cost).
 * A line returned in full has exactly nothing left, so returns never leave paise behind.
 */
function remaining(line: CommissionLine, returned: Returned) {
  if (returned.qty >= line.quantity) return { value: new Decimal(0), profit: new Decimal(0) };
  const knownLeft = line.quantity - line.unknownCostQty - returned.knownQty;
  const value = round2(line.taxable.mul(line.quantity - returned.qty).div(line.quantity));
  const knownValue = round2(line.taxable.mul(knownLeft).div(line.quantity));
  return { value, profit: knownValue.sub(line.cogs.sub(returned.cogs)) };
}

function totals(lines: CommissionLine[], returned: Map<string, Returned>) {
  return lines.reduce(
    (t, l) => {
      const r = remaining(l, returned.get(l.id) ?? NONE);
      return { value: t.value.add(r.value), profit: t.profit.add(r.profit) };
    },
    { value: new Decimal(0), profit: new Decimal(0) },
  );
}

/**
 * A sale earns rate × its gross profit (goods value excluding GST − cost of goods)
 * on the day it was fulfilled. Units with no known cost earn nothing, and a sale
 * that makes a loss earns nothing rather than eating into other commission.
 * Each return recomputes what the sale still earns on what's left and takes back
 * the difference on the return's day, so a sale returned in full nets to exactly 0.
 */
export function commissionEntries(order: CommissionOrder): CommissionEntry[] {
  if (!order.fulfilledDate) return [];
  const pct = order.rate.div(100);
  const earned = (profit: Decimal) => round2(Decimal.max(profit, 0).mul(pct));
  const ref = { id: order.id, code: order.code };
  const returned = new Map<string, Returned>();

  let before = totals(order.lines, returned);
  let earnedBefore = earned(before.profit);
  const entries: CommissionEntry[] = [
    {
      kind: "SALE",
      date: order.fulfilledDate,
      salespersonId: order.salespersonId,
      order: ref,
      salesReturn: null,
      rate: order.rate,
      value: before.value,
      profit: before.profit,
      commission: earnedBefore,
      costMissingUnits: order.lines.reduce((s, l) => s + l.unknownCostQty, 0),
    },
  ];

  const returns = [...order.returns].sort(
    (a, b) => a.businessDate.localeCompare(b.businessDate) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const r of returns) {
    for (const rl of r.lines) {
      const prior = returned.get(rl.orderLineId) ?? NONE;
      returned.set(rl.orderLineId, {
        qty: prior.qty + rl.quantity,
        knownQty: prior.knownQty + (rl.quantity - rl.unknownCostQty),
        cogs: prior.cogs.add(rl.cogs),
      });
    }
    const after = totals(order.lines, returned);
    const earnedAfter = earned(after.profit);
    entries.push({
      kind: "RETURN",
      date: r.businessDate,
      salespersonId: order.salespersonId,
      order: ref,
      salesReturn: { id: r.id, code: r.code },
      rate: order.rate,
      value: after.value.sub(before.value),
      profit: after.profit.sub(before.profit),
      commission: earnedAfter.sub(earnedBefore),
      costMissingUnits: r.lines.reduce((s, l) => s + l.unknownCostQty, 0),
    });
    before = after;
    earnedBefore = earnedAfter;
  }
  return entries;
}

export interface CommissionTotals {
  sales: number;
  salesValue: Decimal;
  grossProfit: Decimal;
  earned: Decimal;
  /** Commission taken back by returns, as a positive amount. */
  returned: Decimal;
  net: Decimal;
  /** Units sold in the period with no known cost (they earned nothing). */
  costMissingUnits: number;
}

export function totalEntries(entries: CommissionEntry[]): CommissionTotals {
  const t = {
    sales: 0,
    salesValue: new Decimal(0),
    grossProfit: new Decimal(0),
    earned: new Decimal(0),
    returned: new Decimal(0),
    net: new Decimal(0),
    costMissingUnits: 0,
  };
  for (const e of entries) {
    if (e.kind === "SALE") {
      t.sales += 1;
      t.earned = t.earned.add(e.commission);
      t.costMissingUnits += e.costMissingUnits;
    } else {
      t.returned = t.returned.sub(e.commission);
      t.costMissingUnits -= e.costMissingUnits;
    }
    t.salesValue = t.salesValue.add(e.value);
    t.grossProfit = t.grossProfit.add(e.profit);
    t.net = t.net.add(e.commission);
  }
  return t;
}
