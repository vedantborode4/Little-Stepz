import { prisma, Prisma } from "@repo/crm-db/client";
import type {
  AccountTransferDto,
  AgeingBucket,
  CollectionsDto,
  CollectionsQuery,
  CustomerCreditDto,
  OutstandingQuery,
  OutstandingRowDto,
  OutstandingSummaryDto,
  PaymentDetailDto,
  PaymentListItemDto,
  PaymentListQuery,
  SalesChannel,
  TransferListQuery,
} from "@repo/crm-schema";
import { fromDbDate, todayIST, toDbDate } from "../../core/dates";
import { notFound } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { Decimal, money } from "../../core/money";
import { creditBalance } from "./ledger";

const d = (v: Prisma.Decimal | null | undefined) => new Decimal((v ?? 0).toString());
const dateRange = (from?: string, to?: string) =>
  from || to ? { gte: from ? toDbDate(from) : undefined, lte: to ? toDbDate(to) : undefined } : undefined;

// ─── Payments ────────────────────────────────────────────────────────────────

const paymentInclude = {
  account: { select: { id: true, name: true, isPersonal: true } },
  customer: { select: { id: true, code: true, name: true } },
  allocations: { include: { order: { select: { id: true, code: true } } } },
  creditEntries: { select: { amount: true } },
  reversalOf: { select: { id: true, code: true } },
  reversedBy: { select: { id: true, code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

const toPaymentListItemDto = (p: PaymentRow): PaymentListItemDto => ({
  id: p.id,
  code: p.code,
  direction: p.direction,
  method: p.method,
  account: p.account,
  amount: money(p.amount),
  fee: money(p.fee),
  businessDate: fromDbDate(p.businessDate),
  reference: p.reference,
  customer: p.customer,
  orderCodes: [...new Set(p.allocations.map((a) => a.order.code))],
  creditAmount: money(p.creditEntries.reduce((s, e) => s.add(d(e.amount)), new Decimal(0))),
  reversalOf: p.reversalOf,
  reversedBy: p.reversedBy,
  createdAt: p.createdAt.toISOString(),
});

const PAYMENT_SORTS = { businessDate: "businessDate", code: "code", amount: "amount", createdAt: "createdAt" };

export async function listPayments(query: PaymentListQuery) {
  const where: Prisma.PaymentWhereInput = {
    direction: query.direction,
    method: query.method,
    accountId: query.accountId,
    customerId: query.customerId,
    account: query.accountKind ? { isPersonal: query.accountKind === "personal" } : undefined,
    businessDate: dateRange(query.from, query.to),
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q, mode: "insensitive" } },
        { customer: { name: { contains: query.q, mode: "insensitive" } } },
        { allocations: { some: { order: { code: { contains: query.q, mode: "insensitive" } } } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: buildOrderBy(query.sort, PAYMENT_SORTS, "createdAt:desc"),
      ...pageWindow(query),
    }),
    prisma.payment.count({ where }),
  ]);
  return paginated(rows.map(toPaymentListItemDto), total, query);
}

export async function getPayment(id: string): Promise<PaymentDetailDto> {
  const p = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!p) throw notFound("Payment");
  return {
    ...toPaymentListItemDto(p),
    notes: p.notes,
    createdByName: p.createdBy?.name ?? null,
    allocations: p.allocations.map((a) => ({ orderId: a.order.id, orderCode: a.order.code, amount: money(a.amount) })),
  };
}

export async function customerCredit(customerId: string): Promise<CustomerCreditDto> {
  const [balance, entries] = await Promise.all([
    creditBalance(prisma, customerId),
    prisma.customerCreditEntry.findMany({
      where: { customerId },
      include: { order: { select: { code: true } }, payment: { select: { code: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return {
    balance: money(balance),
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: money(e.amount),
      orderCode: e.order?.code ?? null,
      paymentCode: e.payment?.code ?? null,
      note: e.note,
      createdByName: e.createdBy?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ─── Collections ─────────────────────────────────────────────────────────────

/**
 * Money in and out by method and account for a period. A void is netted against
 * what it undoes (a reversed receipt lowers "received", a reversed refund lowers
 * "refunded"), so a mistake and its correction cancel out. Transfers between
 * accounts are shown per account but are never received money.
 */
export async function collections(query: CollectionsQuery): Promise<CollectionsDto> {
  const range = { gte: toDbDate(query.from), lte: toDbDate(query.to) };
  const [payments, accounts, transfers, allocations, creditEntries] = await Promise.all([
    prisma.payment.findMany({
      where: { businessDate: range },
      select: { accountId: true, method: true, direction: true, amount: true, fee: true, reversalOfId: true },
    }),
    prisma.receivingAccount.findMany({ select: { id: true, name: true, method: true, isPersonal: true }, orderBy: { name: "asc" } }),
    prisma.accountTransfer.findMany({ where: { businessDate: range }, select: { fromAccountId: true, toAccountId: true, amount: true } }),
    prisma.paymentAllocation.findMany({
      where: { payment: { businessDate: range } },
      select: { amount: true, order: { select: { channel: true } } },
    }),
    prisma.customerCreditEntry.findMany({ where: { payment: { businessDate: range } }, select: { amount: true } }),
  ]);

  type Acc = { received: Decimal; refunded: Decimal; fees: Decimal; transfersIn: Decimal; transfersOut: Decimal; count: number };
  const zero = (): Acc => ({
    received: new Decimal(0),
    refunded: new Decimal(0),
    fees: new Decimal(0),
    transfersIn: new Decimal(0),
    transfersOut: new Decimal(0),
    count: 0,
  });
  const byAccount = new Map(accounts.map((a) => [a.id, zero()]));
  const byMethod = new Map<string, Acc>();

  for (const p of payments) {
    const amount = d(p.amount);
    const fee = d(p.fee);
    // A reversal undoes its original: a reversed receipt (OUT) reduces received, a reversed refund (IN) reduces refunded.
    const isReceipt = p.reversalOfId ? p.direction === "OUT" : p.direction === "IN";
    const sign = p.reversalOfId ? -1 : 1;
    if (!byMethod.has(p.method)) byMethod.set(p.method, zero());
    for (const acc of [byAccount.get(p.accountId)!, byMethod.get(p.method)!]) {
      if (isReceipt) {
        acc.received = acc.received.add(amount.mul(sign));
        acc.fees = acc.fees.add(fee.mul(sign));
      } else {
        acc.refunded = acc.refunded.add(amount.mul(sign));
      }
      acc.count += sign;
    }
  }
  for (const t of transfers) {
    byAccount.get(t.fromAccountId)!.transfersOut = byAccount.get(t.fromAccountId)!.transfersOut.add(d(t.amount));
    byAccount.get(t.toAccountId)!.transfersIn = byAccount.get(t.toAccountId)!.transfersIn.add(d(t.amount));
  }

  const sum = (pick: (a: Acc) => Decimal) => [...byAccount.values()].reduce((s, a) => s.add(pick(a)), new Decimal(0));
  const received = sum((a) => a.received);
  const refunded = sum((a) => a.refunded);
  const fees = sum((a) => a.fees);
  const netOf = (accountIds: string[]) =>
    accountIds.reduce((s, id) => s.add(byAccount.get(id)!.received.sub(byAccount.get(id)!.refunded)), new Decimal(0));

  const channels = new Map<SalesChannel | null, Decimal>();
  for (const a of allocations) channels.set(a.order.channel, (channels.get(a.order.channel) ?? new Decimal(0)).add(d(a.amount)));
  const toCredit = creditEntries.reduce((s, e) => s.add(d(e.amount)), new Decimal(0));
  if (!toCredit.isZero()) channels.set(null, toCredit);

  return {
    from: query.from,
    to: query.to,
    totals: {
      payments: [...byAccount.values()].reduce((s, a) => s + a.count, 0),
      received: money(received),
      refunded: money(refunded),
      net: money(received.sub(refunded)),
      fees: money(fees),
      netAfterFees: money(received.sub(refunded).sub(fees)),
    },
    business: money(netOf(accounts.filter((a) => !a.isPersonal).map((a) => a.id))),
    personal: money(netOf(accounts.filter((a) => a.isPersonal).map((a) => a.id))),
    byMethod: [...byMethod.entries()].map(([method, a]) => ({
      method: method as CollectionsDto["byMethod"][number]["method"],
      count: a.count,
      received: money(a.received),
      refunded: money(a.refunded),
      net: money(a.received.sub(a.refunded)),
    })),
    byAccount: accounts
      .map((acc) => {
        const a = byAccount.get(acc.id)!;
        return {
          accountId: acc.id,
          name: acc.name,
          method: acc.method,
          isPersonal: acc.isPersonal,
          received: money(a.received),
          refunded: money(a.refunded),
          fees: money(a.fees),
          transfersIn: money(a.transfersIn),
          transfersOut: money(a.transfersOut),
          movement: money(a.received.sub(a.refunded).add(a.transfersIn).sub(a.transfersOut)),
        };
      })
      .filter((a) => [a.received, a.refunded, a.transfersIn, a.transfersOut].some((v) => v !== "0.00")),
    byChannel: [...channels.entries()].map(([channel, amount]) => ({ channel, amount: money(amount) })),
  };
}

// ─── Outstanding & ageing ────────────────────────────────────────────────────

/**
 * Orders with money still due. Ages count from the order date into 0–30, 31–60
 * and 60+ days. Orders not yet handed over or dispatched are included but
 * flagged: that balance isn't a receivable until the goods go.
 */
function outstandingSql(query: Pick<OutstandingQuery, "customerId" | "q">, today: string) {
  const conditions: Prisma.Sql[] = [Prisma.sql`o.status NOT IN ('DRAFT', 'CANCELLED')`];
  if (query.customerId) conditions.push(Prisma.sql`o."customerId" = ${query.customerId}`);
  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(Prisma.sql`(o.code ILIKE ${like} OR c.name ILIKE ${like} OR c.code ILIKE ${like})`);
  }
  return Prisma.sql`
    WITH paid AS (SELECT "orderId", SUM(amount) AS paid FROM "PaymentAllocation" GROUP BY "orderId"),
    due AS (
      SELECT o.id AS "orderId", o.code, o.type, o.status, o."orderDate", o."dueDate", o."grandTotal",
        COALESCE(p.paid, 0) AS paid, o."grandTotal" - COALESCE(p.paid, 0) AS due,
        (${toDbDate(today)}::date - o."orderDate")::int AS "ageDays",
        o."fulfilledAt" IS NOT NULL AS fulfilled,
        o."dueDate" IS NOT NULL AND o."dueDate" < ${toDbDate(today)}::date AS overdue,
        c.id AS "customerId", c.code AS "customerCode", c.name AS "customerName"
      FROM "SalesOrder" o
      LEFT JOIN paid p ON p."orderId" = o.id
      LEFT JOIN "Customer" c ON c.id = o."customerId"
      WHERE ${Prisma.join(conditions, " AND ")}
    ),
    aged AS (
      SELECT due.*, CASE WHEN "ageDays" <= 30 THEN '0-30' WHEN "ageDays" <= 60 THEN '31-60' ELSE '60+' END AS bucket
      FROM due WHERE due > 0
    )`;
}

interface OutstandingSqlRow {
  orderId: string;
  code: string;
  type: OutstandingRowDto["type"];
  status: OutstandingRowDto["status"];
  orderDate: Date;
  dueDate: Date | null;
  grandTotal: Prisma.Decimal;
  paid: Prisma.Decimal;
  due: Prisma.Decimal;
  ageDays: number;
  fulfilled: boolean;
  overdue: boolean;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  bucket: AgeingBucket;
}

export async function listOutstanding(query: OutstandingQuery) {
  const base = outstandingSql(query, todayIST());
  const bucket = query.bucket ? Prisma.sql`WHERE bucket = ${query.bucket}` : Prisma.empty;
  const { skip, take } = pageWindow(query);
  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<OutstandingSqlRow[]>`${base} SELECT * FROM aged ${bucket} ORDER BY "ageDays" DESC, code LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ count: number }[]>`${base} SELECT COUNT(*)::int AS count FROM aged ${bucket}`,
  ]);
  const items: OutstandingRowDto[] = rows.map((r) => ({
    orderId: r.orderId,
    code: r.code,
    type: r.type,
    status: r.status,
    customer: r.customerId ? { id: r.customerId, code: r.customerCode!, name: r.customerName! } : null,
    orderDate: fromDbDate(r.orderDate),
    dueDate: r.dueDate ? fromDbDate(r.dueDate) : null,
    grandTotal: money(d(r.grandTotal)),
    paid: money(d(r.paid)),
    due: money(d(r.due)),
    ageDays: r.ageDays,
    bucket: r.bucket,
    overdue: r.overdue,
    fulfilled: r.fulfilled,
  }));
  return paginated(items, counted[0]?.count ?? 0, query);
}

export async function outstandingSummary(query: Pick<OutstandingQuery, "customerId">): Promise<OutstandingSummaryDto> {
  const base = outstandingSql(query, todayIST());
  const [row] = await prisma.$queryRaw<
    {
      orders: number;
      total: Prisma.Decimal;
      receivable: Prisma.Decimal;
      overdue: Prisma.Decimal;
      b1: Prisma.Decimal;
      b2: Prisma.Decimal;
      b3: Prisma.Decimal;
    }[]
  >`${base}
    SELECT COUNT(*)::int AS orders, COALESCE(SUM(due), 0) AS total,
      COALESCE(SUM(due) FILTER (WHERE fulfilled), 0) AS receivable,
      COALESCE(SUM(due) FILTER (WHERE overdue), 0) AS overdue,
      COALESCE(SUM(due) FILTER (WHERE bucket = '0-30'), 0) AS b1,
      COALESCE(SUM(due) FILTER (WHERE bucket = '31-60'), 0) AS b2,
      COALESCE(SUM(due) FILTER (WHERE bucket = '60+'), 0) AS b3
    FROM aged`;
  const total = d(row!.total);
  const receivable = d(row!.receivable);
  return {
    orders: row!.orders,
    total: money(total),
    receivable: money(receivable),
    openOrders: money(total.sub(receivable)),
    overdue: money(d(row!.overdue)),
    buckets: { "0-30": money(d(row!.b1)), "31-60": money(d(row!.b2)), "60+": money(d(row!.b3)) },
  };
}

export async function customerOutstanding(customerId: string): Promise<Decimal> {
  return new Decimal((await outstandingSummary({ customerId })).total);
}

// ─── Transfers ───────────────────────────────────────────────────────────────

const transferInclude = {
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  reversalOf: { select: { id: true, code: true } },
  reversedBy: { select: { id: true, code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.AccountTransferInclude;

export const toTransferDto = (t: Prisma.AccountTransferGetPayload<{ include: typeof transferInclude }>): AccountTransferDto => ({
  id: t.id,
  code: t.code,
  from: t.fromAccount,
  to: t.toAccount,
  amount: money(t.amount),
  businessDate: fromDbDate(t.businessDate),
  reference: t.reference,
  notes: t.notes,
  reversalOf: t.reversalOf,
  reversedBy: t.reversedBy,
  createdByName: t.createdBy?.name ?? null,
  createdAt: t.createdAt.toISOString(),
});

export async function listTransfers(query: TransferListQuery) {
  const where: Prisma.AccountTransferWhereInput = {
    businessDate: dateRange(query.from, query.to),
    ...(query.q && {
      OR: [{ code: { contains: query.q, mode: "insensitive" } }, { reference: { contains: query.q, mode: "insensitive" } }],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.accountTransfer.findMany({
      where,
      include: transferInclude,
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      ...pageWindow(query),
    }),
    prisma.accountTransfer.count({ where }),
  ]);
  return paginated(rows.map(toTransferDto), total, query);
}

export async function getTransfer(id: string) {
  const row = await prisma.accountTransfer.findUnique({ where: { id }, include: transferInclude });
  if (!row) throw notFound("Transfer");
  return toTransferDto(row);
}
