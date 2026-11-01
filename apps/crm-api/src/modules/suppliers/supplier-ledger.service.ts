import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import {
  SUPPLIER_ENTRY_TYPE_LABELS,
  SUPPLIER_ENTRY_TYPES,
  type CreateSupplierEntryInput,
  type SupplierBalanceDto,
  type SupplierEntryType,
  type SupplierLedgerDto,
  type SupplierLedgerEntryDto,
  type SupplierLedgerQuery,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { fromDbDate, resolveBusinessDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec, Decimal, decOrZero, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertCashDaysOpen } from "../cash/cash-lock";

/**
 * Money between the business and its suppliers, kept apart from stock and from
 * expenses. A positive balance is our money the supplier holds (an advance or
 * credit); a negative one is what we owe. Entries are append-only; a mistake is
 * voided by a reversal row dated the day it is voided.
 */

const entryInclude = {
  account: { select: { id: true, name: true, isPersonal: true } },
  purchase: { select: { id: true, code: true } },
  reversalOf: { select: { id: true, code: true } },
  reversedBy: { select: { id: true, code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.SupplierLedgerEntryInclude;

type EntryRow = Prisma.SupplierLedgerEntryGetPayload<{ include: typeof entryInclude }>;

const toEntryDto = (e: EntryRow, balanceAfter: Decimal): SupplierLedgerEntryDto => ({
  id: e.id,
  code: e.code,
  type: e.type,
  amount: money(e.amount),
  balanceAfter: money(balanceAfter),
  businessDate: fromDbDate(e.businessDate),
  account: e.account,
  purchase: e.purchase,
  reference: e.reference,
  notes: e.notes,
  reversalOf: e.reversalOf,
  reversedBy: e.reversedBy,
  createdByName: e.createdBy?.name ?? null,
  createdAt: e.createdAt.toISOString(),
});

/** Each entry's running balance, in ledger order: date, then the moment it was recorded. */
async function runningBalances(supplierId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, Decimal>();
  const rows = await prisma.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
    SELECT id, balance FROM (
      SELECT id, SUM(amount) OVER (ORDER BY "businessDate", "createdAt", id) AS balance
      FROM "SupplierLedgerEntry" WHERE "supplierId" = ${supplierId}
    ) ledger
    WHERE id IN (${Prisma.join(ids)})`;
  return new Map(rows.map((r) => [r.id, decOrZero(r.balance)]));
}

/** Net balance per supplier; suppliers without entries are left out. */
export async function supplierBalances(supplierIds?: string[]) {
  const rows = await prisma.supplierLedgerEntry.groupBy({
    by: ["supplierId"],
    where: supplierIds ? { supplierId: { in: supplierIds } } : undefined,
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.supplierId, decOrZero(r._sum.amount)]));
}

export async function supplierSummary(supplierId: string): Promise<SupplierBalanceDto> {
  const [byType, last] = await Promise.all([
    prisma.supplierLedgerEntry.groupBy({ by: ["type"], where: { supplierId }, _sum: { amount: true }, _count: true }),
    prisma.supplierLedgerEntry.aggregate({ where: { supplierId }, _max: { businessDate: true } }),
  ]);
  // A void carries its original's type with the opposite sign, so a plain sum per type nets it out.
  const totals = Object.fromEntries(SUPPLIER_ENTRY_TYPES.map((t) => [t, new Decimal(0)])) as Record<SupplierEntryType, Decimal>;
  let entryCount = 0;
  for (const row of byType) {
    totals[row.type] = decOrZero(row._sum.amount);
    entryCount += row._count;
  }
  const balance = Object.values(totals).reduce((s, v) => s.add(v), new Decimal(0));
  return {
    balance: money(balance),
    totals: Object.fromEntries(SUPPLIER_ENTRY_TYPES.map((t) => [t, money(totals[t])])) as Record<SupplierEntryType, string>,
    entryCount,
    lastEntryDate: last._max.businessDate ? fromDbDate(last._max.businessDate) : null,
  };
}

export async function listSupplierLedger(supplierId: string, query: SupplierLedgerQuery): Promise<SupplierLedgerDto> {
  if (!(await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }))) throw notFound("Supplier");
  const where: Prisma.SupplierLedgerEntryWhereInput = {
    supplierId,
    type: query.type,
    accountId: query.accountId,
    businessDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q, mode: "insensitive" } },
        { notes: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };
  const [rows, total, summary] = await Promise.all([
    prisma.supplierLedgerEntry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...pageWindow(query),
    }),
    prisma.supplierLedgerEntry.count({ where }),
    supplierSummary(supplierId),
  ]);
  const balances = await runningBalances(
    supplierId,
    rows.map((r) => r.id),
  );
  return {
    ...paginated(
      rows.map((r) => toEntryDto(r, balances.get(r.id)!)),
      total,
      query,
    ),
    summary,
  };
}

export async function getSupplierEntry(id: string) {
  const row = await prisma.supplierLedgerEntry.findUnique({ where: { id }, include: entryInclude });
  if (!row) throw notFound("Supplier entry");
  const balances = await runningBalances(row.supplierId, [row.id]);
  return toEntryDto(row, balances.get(row.id)!);
}

/** The sign an entry carries: payments and credit raise what the supplier holds of ours; goods and refunds lower it. */
function signedAmount(input: CreateSupplierEntryInput) {
  const amount = dec(input.amount);
  switch (input.type) {
    case "PAYMENT":
    case "CREDIT_NOTE":
      return amount;
    case "GOODS_RECEIVED":
    case "REFUND":
      return amount.neg();
    case "OPENING":
    case "ADJUSTMENT":
      return input.direction === "THEIRS" ? amount.neg() : amount;
  }
}

async function assertEntryRefs(tx: Tx, supplierId: string, input: CreateSupplierEntryInput) {
  if (input.type === "PAYMENT" || input.type === "REFUND") {
    const account = await tx.receivingAccount.findUnique({ where: { id: input.accountId! }, select: { isActive: true } });
    if (!account?.isActive)
      throw new ApiError(400, "INVALID_ACCOUNT", "Choose an active account", { fieldErrors: { accountId: ["Choose an active account"] } });
  }
  if (input.type === "GOODS_RECEIVED" && input.purchaseId) {
    const purchase = await tx.purchaseShipment.findUnique({ where: { id: input.purchaseId }, select: { supplierId: true, status: true } });
    if (!purchase || purchase.supplierId !== supplierId || purchase.status !== "RECEIVED") {
      throw new ApiError(400, "INVALID_PURCHASE", "Choose a received purchase from this supplier", {
        fieldErrors: { purchaseId: ["Choose a received purchase from this supplier"] },
      });
    }
  }
  if (input.type === "OPENING") {
    const opening = await tx.supplierLedgerEntry.findFirst({
      where: { supplierId, type: "OPENING", reversalOfId: null, reversedBy: null },
      select: { code: true },
    });
    if (opening) {
      throw new ApiError(
        409,
        "OPENING_EXISTS",
        `This supplier already has an opening balance (${opening.code}); void it to enter a new one`,
      );
    }
  }
}

export async function createSupplierEntry(supplierId: string, input: CreateSupplierEntryInput, ctx: RequestContext) {
  const id = await withTransaction(async (tx) => {
    // One writer per supplier at a time, so the opening-balance check can't race.
    const [supplier] = await tx.$queryRaw<{ name: string }[]>`SELECT name FROM "Supplier" WHERE id = ${supplierId} FOR UPDATE`;
    if (!supplier) throw notFound("Supplier");
    await assertEntryRefs(tx, supplierId, input);
    const businessDate = resolveBusinessDate(input.businessDate);
    const accountId = input.type === "PAYMENT" || input.type === "REFUND" ? input.accountId! : null;
    if (accountId) await assertCashDaysOpen(tx, [{ accountId, businessDate }]);
    const amount = signedAmount(input);
    const entry = await tx.supplierLedgerEntry.create({
      data: {
        code: await nextCode(tx, "SLE", 5),
        supplierId,
        type: input.type,
        amount,
        businessDate,
        accountId,
        purchaseId: input.type === "GOODS_RECEIVED" ? (input.purchaseId ?? null) : null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "supplier_entry.recorded",
      entity: "SupplierLedgerEntry",
      entityId: entry.id,
      after: { code: entry.code, supplier: supplier.name, type: SUPPLIER_ENTRY_TYPE_LABELS[input.type], amount: money(amount), accountId },
    });
    return entry.id;
  });
  return getSupplierEntry(id);
}

export async function voidSupplierEntry(id: string, reason: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupplierLedgerEntry" WHERE id = ${id} FOR UPDATE`;
    const original = await tx.supplierLedgerEntry.findUnique({ where: { id }, include: { reversedBy: { select: { code: true } } } });
    if (!original) throw notFound("Supplier entry");
    if (original.reversalOfId) throw new ApiError(409, "CANNOT_VOID_REVERSAL", "A void can't be voided. Record the entry again instead.");
    if (original.reversedBy)
      throw new ApiError(409, "ALREADY_VOIDED", `${original.code} was already voided by ${original.reversedBy.code}`);
    const today = resolveBusinessDate(undefined);
    if (original.accountId) await assertCashDaysOpen(tx, [{ accountId: original.accountId, businessDate: today }]);
    const reversal = await tx.supplierLedgerEntry.create({
      data: {
        code: await nextCode(tx, "SLE", 5),
        supplierId: original.supplierId,
        type: original.type,
        amount: original.amount.neg(),
        businessDate: today,
        accountId: original.accountId,
        purchaseId: original.purchaseId,
        reference: original.code,
        notes: reason,
        reversalOfId: original.id,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "supplier_entry.voided",
      entity: "SupplierLedgerEntry",
      entityId: id,
      after: { code: original.code, reversal: reversal.code, reason },
    });
  });
  return getSupplierEntry(id);
}
