import { prisma, type Tx } from "@repo/crm-db/client";
import {
  COMMISSION_EXPENSE_CATEGORY,
  type CommissionDetailDto,
  type CommissionPayoutInput,
  type CommissionQuery,
  type CommissionSummaryDto,
  type CommissionTotalsDto,
  type ExpenseDto,
  type MyCommissionDto,
} from "@repo/crm-schema";
import { fromDbDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { notFound, type RequestContext } from "../../core/http";
import { dec, Decimal, decOrZero, money } from "../../core/money";
import { nameKey } from "../../core/sequence";
import { expenseInclude, getExpense, insertExpense, toExpenseDto } from "../expenses/expenses.service";
import { commissionEntries, totalEntries, type CommissionEntry } from "./commission-maths";
import { salespersonInclude, toSalespersonDto } from "./salespeople.service";

type Db = Tx | typeof prisma;

const sum = <T>(rows: T[], pick: (r: T) => { toString(): string }) => rows.reduce((s, r) => s.add(dec(pick(r).toString())), new Decimal(0));

/** Every commission entry ever, worked out from the frozen sale and return records. */
async function allEntries(db: Db, salespersonId?: string): Promise<CommissionEntry[]> {
  const orders = await db.salesOrder.findMany({
    where: { salespersonId: salespersonId ?? { not: null }, fulfilledDate: { not: null } },
    select: {
      id: true,
      code: true,
      salespersonId: true,
      commissionRate: true,
      fulfilledDate: true,
      lines: { select: { id: true, quantity: true, taxableValue: true, cogs: true, unknownCostQty: true } },
      returns: {
        select: {
          id: true,
          code: true,
          businessDate: true,
          createdAt: true,
          lines: { select: { orderLineId: true, quantity: true, cogs: true, unknownCostQty: true } },
        },
      },
    },
  });
  return orders.flatMap((o) =>
    commissionEntries({
      id: o.id,
      code: o.code,
      salespersonId: o.salespersonId!,
      rate: dec(o.commissionRate!.toString()),
      fulfilledDate: fromDbDate(o.fulfilledDate!),
      lines: o.lines.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        taxable: dec(l.taxableValue.toString()),
        cogs: decOrZero(l.cogs),
        unknownCostQty: l.unknownCostQty,
      })),
      returns: o.returns.map((r) => ({
        id: r.id,
        code: r.code,
        businessDate: fromDbDate(r.businessDate),
        createdAt: r.createdAt,
        lines: r.lines.map((l) => ({
          orderLineId: l.orderLineId,
          quantity: l.quantity,
          cogs: decOrZero(l.cogs),
          unknownCostQty: l.unknownCostQty,
        })),
      })),
    }),
  );
}

/** Payouts net of voids: a void row carries the amount it cancels. */
async function allPayouts(db: Db, salespersonId?: string) {
  const rows = await db.expense.findMany({
    where: { salespersonId: salespersonId ?? { not: null } },
    select: { salespersonId: true, amount: true, reversalOfId: true, businessDate: true },
  });
  return rows.map((r) => ({
    salespersonId: r.salespersonId!,
    date: fromDbDate(r.businessDate),
    amount: r.reversalOfId ? dec(r.amount.toString()).neg() : dec(r.amount.toString()),
  }));
}

/** All-time net commission (earned less taken back by returns) per salesperson. */
export async function netCommission(db: Db, salespersonIds: string[]): Promise<Map<string, Decimal>> {
  const net = new Map<string, Decimal>();
  for (const id of salespersonIds) net.set(id, totalEntries(await allEntries(db, id)).net);
  return net;
}

const inPeriod = (q: CommissionQuery) => (r: { date: string }) => r.date >= q.from && r.date <= q.to;

function totalsDto(period: CommissionEntry[], all: CommissionEntry[], paidInPeriod: Decimal, paidAllTime: Decimal): CommissionTotalsDto {
  const t = totalEntries(period);
  return {
    sales: t.sales,
    salesValue: money(t.salesValue),
    grossProfit: money(t.grossProfit),
    costMissingUnits: t.costMissingUnits,
    earned: money(t.earned),
    returned: money(t.returned),
    net: money(t.net),
    paid: money(paidInPeriod),
    owed: money(totalEntries(all).net.sub(paidAllTime)),
  };
}

const addTotals = (a: CommissionTotalsDto, b: CommissionTotalsDto): CommissionTotalsDto => ({
  sales: a.sales + b.sales,
  salesValue: money(dec(a.salesValue).add(b.salesValue)),
  grossProfit: money(dec(a.grossProfit).add(b.grossProfit)),
  costMissingUnits: a.costMissingUnits + b.costMissingUnits,
  earned: money(dec(a.earned).add(b.earned)),
  returned: money(dec(a.returned).add(b.returned)),
  net: money(dec(a.net).add(b.net)),
  paid: money(dec(a.paid).add(b.paid)),
  owed: money(dec(a.owed).add(b.owed)),
});

const ZERO_TOTALS: CommissionTotalsDto = {
  sales: 0,
  salesValue: "0.00",
  grossProfit: "0.00",
  costMissingUnits: 0,
  earned: "0.00",
  returned: "0.00",
  net: "0.00",
  paid: "0.00",
  owed: "0.00",
};

/** Each salesperson's commission for the period, and what is still owed to them overall. */
export async function commissionSummary(query: CommissionQuery): Promise<CommissionSummaryDto> {
  const [people, entries, payouts] = await Promise.all([
    prisma.salesperson.findMany({ include: salespersonInclude, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    allEntries(prisma),
    allPayouts(prisma),
  ]);
  const rows = people
    .map((p) => {
      const all = entries.filter((e) => e.salespersonId === p.id);
      const paid = payouts.filter((x) => x.salespersonId === p.id);
      return {
        salesperson: toSalespersonDto(p),
        ...totalsDto(
          all.filter(inPeriod(query)),
          all,
          sum(paid.filter(inPeriod(query)), (x) => x.amount),
          sum(paid, (x) => x.amount),
        ),
      };
    })
    // Former staff drop off once they have nothing in the period and nothing owed either way.
    .filter((r) => r.salesperson.isActive || r.sales > 0 || !dec(r.net).isZero() || !dec(r.paid).isZero() || !dec(r.owed).isZero());
  return {
    from: query.from,
    to: query.to,
    rows,
    totals: rows.reduce<CommissionTotalsDto>((t, r) => addTotals(t, r), ZERO_TOTALS),
  };
}

/** One salesperson's sales and returns in the period, with the payouts made to them. */
export async function commissionDetail(salespersonId: string, query: CommissionQuery): Promise<CommissionDetailDto> {
  const person = await prisma.salesperson.findUnique({ where: { id: salespersonId }, include: salespersonInclude });
  if (!person) throw notFound("Salesperson");
  const [entries, payouts, payoutRows] = await Promise.all([
    allEntries(prisma, salespersonId),
    allPayouts(prisma, salespersonId),
    prisma.expense.findMany({
      where: { salespersonId, businessDate: { gte: toDbDate(query.from), lte: toDbDate(query.to) } },
      include: expenseInclude,
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const period = entries
    .filter(inPeriod(query))
    .sort((a, b) => a.date.localeCompare(b.date) || a.order.code.localeCompare(b.order.code) || (a.kind === "SALE" ? -1 : 1));
  return {
    from: query.from,
    to: query.to,
    salesperson: toSalespersonDto(person),
    totals: totalsDto(
      period,
      entries,
      sum(payouts.filter(inPeriod(query)), (x) => x.amount),
      sum(payouts, (x) => x.amount),
    ),
    entries: period.map((e) => ({
      kind: e.kind,
      date: e.date,
      order: e.order,
      salesReturn: e.salesReturn,
      rate: e.rate.toString(),
      value: money(e.value),
      profit: money(e.profit),
      commission: money(e.commission),
      costMissingUnits: e.costMissingUnits,
    })),
    payouts: payoutRows.map(toExpenseDto),
  };
}

/**
 * The commission of the salesperson linked to this login: what each sale and
 * return earned or took back, never the sale value or profit behind it.
 */
export async function myCommission(userId: string, query: CommissionQuery): Promise<MyCommissionDto> {
  const person = await prisma.salesperson.findUnique({ where: { userId } });
  const empty = { sales: 0, earned: "0.00", returned: "0.00", net: "0.00", paid: "0.00", owed: "0.00" };
  if (!person) return { from: query.from, to: query.to, salesperson: null, totals: empty, entries: [], payouts: [] };
  const detail = await commissionDetail(person.id, query);
  const { sales, earned, returned, net, paid, owed } = detail.totals;
  return {
    from: query.from,
    to: query.to,
    salesperson: { id: person.id, staffCode: person.staffCode, name: person.name, commissionRate: person.commissionRate.toString() },
    totals: { sales, earned, returned, net, paid, owed },
    entries: detail.entries.map((e) => ({
      kind: e.kind,
      date: e.date,
      orderCode: e.order.code,
      returnCode: e.salesReturn?.code ?? null,
      rate: e.rate,
      commission: e.commission,
    })),
    payouts: detail.payouts.map((p) => ({
      id: p.id,
      code: p.code,
      businessDate: p.businessDate,
      amount: p.reversalOf ? money(dec(p.amount).neg()) : p.amount,
      reference: p.reference,
    })),
  };
}

/** Every commission payout dated in the period, voids included, newest first. */
export async function listPayouts(query: CommissionQuery): Promise<ExpenseDto[]> {
  const rows = await prisma.expense.findMany({
    where: { salespersonId: { not: null }, businessDate: { gte: toDbDate(query.from), lte: toDbDate(query.to) } },
    include: expenseInclude,
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toExpenseDto);
}

/**
 * Money paid to a salesperson against their commission. It is an expense in the
 * "Staff commission" category, so it leaves its account, shows in that day's
 * cash count and is voided like any other expense. Paying more than is owed is
 * allowed; the balance then shows as paid in advance.
 */
export async function recordPayout(input: CommissionPayoutInput, ctx: RequestContext): Promise<ExpenseDto> {
  const id = await withTransaction(async (tx) => {
    const person = await tx.salesperson.findUnique({ where: { id: input.salespersonId } });
    if (!person) throw notFound("Salesperson");
    const category = await tx.expenseCategory.upsert({
      where: { nameKey: nameKey(COMMISSION_EXPENSE_CATEGORY) },
      create: { name: COMMISSION_EXPENSE_CATEGORY, nameKey: nameKey(COMMISSION_EXPENSE_CATEGORY) },
      update: {},
    });
    return insertExpense(tx, ctx, {
      categoryId: category.id,
      kind: "OPERATING",
      accountId: input.accountId,
      amount: input.amount,
      businessDate: input.businessDate,
      vendor: `${person.name} (${person.staffCode})`,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      salespersonId: person.id,
    });
  });
  return getExpense(id);
}
