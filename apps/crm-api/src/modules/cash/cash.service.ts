import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type {
  CashDayBreakdownDto,
  CashDayDto,
  CashSessionDto,
  CashSessionListQuery,
  CloseCashDayInput,
  OpenCashDayInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { fromDbDate, resolveBusinessDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec, Decimal, decOrZero, money } from "../../core/money";

type Db = Tx | typeof prisma;

const sessionInclude = {
  account: { select: { id: true, name: true } },
  openedBy: { select: { name: true } },
  closedBy: { select: { name: true } },
} satisfies Prisma.CashSessionInclude;

const toSessionDto = (s: Prisma.CashSessionGetPayload<{ include: typeof sessionInclude }>): CashSessionDto => ({
  id: s.id,
  account: s.account,
  businessDate: fromDbDate(s.businessDate),
  status: s.status,
  openingAmount: money(s.openingAmount),
  expectedAmount: s.expectedAmount ? money(s.expectedAmount) : null,
  countedAmount: s.countedAmount ? money(s.countedAmount) : null,
  discrepancy: s.discrepancy ? money(s.discrepancy) : null,
  notes: s.notes,
  openedByName: s.openedBy?.name ?? null,
  openedAt: s.openedAt.toISOString(),
  closedByName: s.closedBy?.name ?? null,
  closedAt: s.closedAt?.toISOString() ?? null,
});

/**
 * What should be in the drawer at the end of the day, from the ledgers alone:
 * opening + cash received − cash refunded − cash expenses + transfers in −
 * transfers out (e.g. a bank deposit). Voids are netted against what they undo.
 */
export async function cashBreakdown(db: Db, accountId: string, date: Date, opening: Decimal): Promise<CashDayBreakdownDto> {
  const [payments, expenses, transfersIn, transfersOut] = await Promise.all([
    db.payment.groupBy({ by: ["direction", "reversalOfId"], where: { accountId, businessDate: date }, _sum: { amount: true } }),
    db.expense.groupBy({ by: ["reversalOfId"], where: { accountId, businessDate: date }, _sum: { amount: true } }),
    db.accountTransfer.aggregate({ where: { toAccountId: accountId, businessDate: date }, _sum: { amount: true } }),
    db.accountTransfer.aggregate({ where: { fromAccountId: accountId, businessDate: date }, _sum: { amount: true } }),
  ]);
  let received = new Decimal(0);
  let refunded = new Decimal(0);
  for (const p of payments) {
    const amount = decOrZero(p._sum.amount);
    // A void of a receipt is an OUT row; a void of a refund is an IN row.
    if (p.reversalOfId === null) {
      if (p.direction === "IN") received = received.add(amount);
      else refunded = refunded.add(amount);
    } else if (p.direction === "OUT") received = received.sub(amount);
    else refunded = refunded.sub(amount);
  }
  const spent = expenses.reduce(
    (s, e) => (e.reversalOfId === null ? s.add(decOrZero(e._sum.amount)) : s.sub(decOrZero(e._sum.amount))),
    new Decimal(0),
  );
  const tIn = decOrZero(transfersIn._sum.amount);
  const tOut = decOrZero(transfersOut._sum.amount);
  return {
    opening: money(opening),
    received: money(received),
    refunded: money(refunded),
    expenses: money(spent),
    transfersIn: money(tIn),
    transfersOut: money(tOut),
    expected: money(opening.add(received).sub(refunded).sub(spent).add(tIn).sub(tOut)),
  };
}

async function cashAccount(db: Db, accountId: string) {
  const account = await db.receivingAccount.findUnique({ where: { id: accountId } });
  if (!account || account.method !== "CASH") {
    throw new ApiError(400, "INVALID_ACCOUNT", "Cash closing is for cash drawers; choose a cash account", {
      fieldErrors: { accountId: ["Choose a cash account"] },
    });
  }
  return account;
}

/** The last count before `date`: the natural opening amount for that day. */
async function previousClose(db: Db, accountId: string, date: Date) {
  const last = await db.cashSession.findFirst({
    where: { accountId, status: "CLOSED", businessDate: { lt: date } },
    orderBy: { businessDate: "desc" },
    select: { businessDate: true, countedAmount: true },
  });
  return last?.countedAmount ? { date: fromDbDate(last.businessDate), counted: decOrZero(last.countedAmount) } : null;
}

export async function cashDay(accountId: string, isoDate: string): Promise<CashDayDto> {
  await cashAccount(prisma, accountId);
  const date = toDbDate(isoDate);
  const [session, prev] = await Promise.all([
    prisma.cashSession.findUnique({ where: { accountId_businessDate: { accountId, businessDate: date } }, include: sessionInclude }),
    previousClose(prisma, accountId, date),
  ]);
  const opening = session ? decOrZero(session.openingAmount) : (prev?.counted ?? new Decimal(0));
  return {
    accountId,
    date: isoDate,
    session: session ? toSessionDto(session) : null,
    previousClose: prev ? { date: prev.date, counted: money(prev.counted) } : null,
    breakdown: await cashBreakdown(prisma, accountId, date, opening),
  };
}

export async function openDay(input: OpenCashDayInput, ctx: RequestContext) {
  const businessDate = resolveBusinessDate(input.businessDate);
  const id = await withTransaction(async (tx) => {
    const account = await cashAccount(tx, input.accountId);
    if (!account.isActive) throw new ApiError(400, "INVALID_ACCOUNT", "That cash drawer is inactive");
    const existing = await tx.cashSession.findUnique({ where: { accountId_businessDate: { accountId: account.id, businessDate } } });
    if (existing) throw new ApiError(409, "DAY_ALREADY_OPEN", `${account.name} already has a session for ${fromDbDate(businessDate)}`);
    const opening = input.openingAmount
      ? dec(input.openingAmount)
      : ((await previousClose(tx, account.id, businessDate))?.counted ?? new Decimal(0));
    const session = await tx.cashSession.create({
      data: { accountId: account.id, businessDate, openingAmount: opening, openedById: ctx.userId },
    });
    await recordAudit(tx, ctx, {
      action: "cash.opened",
      entity: "CashSession",
      entityId: session.id,
      after: { account: account.name, date: fromDbDate(businessDate), opening: money(opening) },
    });
    return session.id;
  });
  return getSession(id);
}

async function lockSession(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${id} FOR UPDATE`;
  const session = await tx.cashSession.findUnique({ where: { id }, include: { account: { select: { name: true } } } });
  if (!session) throw notFound("Cash session");
  return session;
}

/**
 * Records the count against the expected amount and locks the day. The
 * discrepancy is recorded for the owner to see; it is never posted anywhere,
 * so sales and payments stay exactly as they were.
 */
export async function closeDay(id: string, input: CloseCashDayInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const session = await lockSession(tx, id);
    if (session.status !== "OPEN")
      throw new ApiError(409, "DAY_CLOSED", `${session.account.name} is already closed for ${fromDbDate(session.businessDate)}`);
    const breakdown = await cashBreakdown(tx, session.accountId, session.businessDate, decOrZero(session.openingAmount));
    const expected = dec(breakdown.expected);
    const counted = dec(input.countedAmount);
    await tx.cashSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        expectedAmount: expected,
        countedAmount: counted,
        discrepancy: counted.sub(expected),
        notes: input.notes ?? null,
        closedById: ctx.userId,
        closedAt: new Date(),
      },
    });
    await recordAudit(tx, ctx, {
      action: "cash.closed",
      entity: "CashSession",
      entityId: id,
      after: { ...breakdown, counted: money(counted), discrepancy: money(counted.sub(expected)) },
    });
  });
  return getSession(id);
}

/** Unlocks a closed day for a correction. The previous count stays in the audit log. */
export async function reopenDay(id: string, reason: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const session = await lockSession(tx, id);
    if (session.status !== "CLOSED") throw new ApiError(409, "DAY_OPEN", "That day isn't closed");
    await tx.cashSession.update({
      where: { id },
      data: { status: "OPEN", expectedAmount: null, countedAmount: null, discrepancy: null, closedById: null, closedAt: null },
    });
    await recordAudit(tx, ctx, {
      action: "cash.reopened",
      entity: "CashSession",
      entityId: id,
      before: { expected: session.expectedAmount, counted: session.countedAmount, discrepancy: session.discrepancy },
      metadata: { reason },
    });
  });
  return getSession(id);
}

export async function getSession(id: string) {
  const row = await prisma.cashSession.findUnique({ where: { id }, include: sessionInclude });
  if (!row) throw notFound("Cash session");
  return toSessionDto(row);
}

export async function listSessions(query: CashSessionListQuery) {
  const where: Prisma.CashSessionWhereInput = {
    accountId: query.accountId,
    businessDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
  };
  const [rows, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: sessionInclude,
      orderBy: [{ businessDate: "desc" }, { openedAt: "desc" }],
      ...pageWindow(query),
    }),
    prisma.cashSession.count({ where }),
  ]);
  return paginated(rows.map(toSessionDto), total, query);
}
