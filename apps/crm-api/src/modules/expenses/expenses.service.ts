import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import type {
  CreateExpenseInput,
  ExpenseCategoryDto,
  ExpenseCategoryInput,
  ExpenseDto,
  ExpenseListQuery,
  UpdateExpenseCategoryInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { fromDbDate, resolveBusinessDate, toDbDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec, money } from "../../core/money";
import { nameKey, nextCode } from "../../core/sequence";
import { assertCashDaysOpen } from "../cash/cash-lock";

// ─── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(includeInactive: boolean): Promise<ExpenseCategoryDto[]> {
  const rows = await prisma.expenseCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, expenseCount: c._count.expenses }));
}

const categoryTaken = (name: string) =>
  new ApiError(409, "NAME_TAKEN", `Category "${name}" already exists`, { fieldErrors: { name: [`Category "${name}" already exists`] } });

export async function createCategory(input: ExpenseCategoryInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    if (await tx.expenseCategory.findUnique({ where: { nameKey: nameKey(input.name) } })) throw categoryTaken(input.name);
    const c = await tx.expenseCategory.create({ data: { ...input, nameKey: nameKey(input.name) } });
    await recordAudit(tx, ctx, { action: "expense_category.created", entity: "ExpenseCategory", entityId: c.id, after: { name: c.name } });
  });
  return listCategories(true);
}

export async function updateCategory(id: string, input: UpdateExpenseCategoryInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const before = await tx.expenseCategory.findUnique({ where: { id } });
    if (!before) throw notFound("Category");
    if (input.name) {
      const clash = await tx.expenseCategory.findUnique({ where: { nameKey: nameKey(input.name) } });
      if (clash && clash.id !== id) throw categoryTaken(input.name);
    }
    const after = await tx.expenseCategory.update({
      where: { id },
      data: { ...input, ...(input.name && { nameKey: nameKey(input.name) }) },
    });
    await recordAudit(tx, ctx, {
      action: "expense_category.updated",
      entity: "ExpenseCategory",
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: { name: after.name, isActive: after.isActive },
    });
  });
  return listCategories(true);
}

// ─── Expenses ────────────────────────────────────────────────────────────────

const expenseInclude = {
  category: { select: { id: true, name: true } },
  order: { select: { id: true, code: true } },
  account: { select: { id: true, name: true, isPersonal: true } },
  reversalOf: { select: { id: true, code: true } },
  reversedBy: { select: { id: true, code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.ExpenseInclude;

const toExpenseDto = (e: Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>): ExpenseDto => ({
  id: e.id,
  code: e.code,
  category: e.category,
  kind: e.kind,
  order: e.order,
  account: e.account,
  amount: money(e.amount),
  businessDate: fromDbDate(e.businessDate),
  vendor: e.vendor,
  reference: e.reference,
  notes: e.notes,
  reversalOf: e.reversalOf,
  reversedBy: e.reversedBy,
  createdByName: e.createdBy?.name ?? null,
  createdAt: e.createdAt.toISOString(),
});

export async function getExpense(id: string) {
  const row = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!row) throw notFound("Expense");
  return toExpenseDto(row);
}

export async function listExpenses(query: ExpenseListQuery) {
  const where: Prisma.ExpenseWhereInput = {
    categoryId: query.categoryId,
    kind: query.kind,
    accountId: query.accountId,
    orderId: query.orderId,
    businessDate:
      query.from || query.to
        ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
        : undefined,
    ...(query.q && {
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { vendor: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q, mode: "insensitive" } },
        { notes: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      ...pageWindow(query),
    }),
    prisma.expense.count({ where }),
  ]);
  return paginated(rows.map(toExpenseDto), total, query);
}

async function assertExpenseRefs(tx: Tx, input: CreateExpenseInput) {
  const [category, account, order] = await Promise.all([
    tx.expenseCategory.findUnique({ where: { id: input.categoryId }, select: { isActive: true } }),
    tx.receivingAccount.findUnique({ where: { id: input.accountId }, select: { isActive: true } }),
    input.orderId ? tx.salesOrder.findUnique({ where: { id: input.orderId }, select: { status: true } }) : Promise.resolve(null),
  ]);
  if (!category?.isActive)
    throw new ApiError(400, "INVALID_CATEGORY", "Choose an active category", {
      fieldErrors: { categoryId: ["Choose an active category"] },
    });
  if (!account?.isActive)
    throw new ApiError(400, "INVALID_ACCOUNT", "Choose an active account", { fieldErrors: { accountId: ["Choose an active account"] } });
  if (input.orderId && (!order || order.status === "DRAFT")) {
    throw new ApiError(400, "INVALID_ORDER", "Choose a confirmed order", { fieldErrors: { orderId: ["Choose a confirmed order"] } });
  }
}

/** Money spent. It leaves its account (and that day's cash count), but is never a sale or a refund. */
export async function createExpense(input: CreateExpenseInput, ctx: RequestContext) {
  return getExpense(await withTransaction((tx) => createExpenseInTx(tx, ctx, input)));
}

/** Creates an expense inside the caller's transaction (imports record many at once); returns its id. */
export async function createExpenseInTx(tx: Tx, ctx: RequestContext, input: CreateExpenseInput) {
  await assertExpenseRefs(tx, input);
  const businessDate = resolveBusinessDate(input.businessDate);
  await assertCashDaysOpen(tx, [{ accountId: input.accountId, businessDate }]);
  const expense = await tx.expense.create({
    data: {
      code: await nextCode(tx, "EXP", 5),
      categoryId: input.categoryId,
      kind: input.kind,
      orderId: input.kind === "ORDER" ? (input.orderId ?? null) : null,
      accountId: input.accountId,
      amount: dec(input.amount),
      businessDate,
      vendor: input.vendor ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
  });
  await recordAudit(tx, ctx, {
    action: "expense.created",
    entity: "Expense",
    entityId: expense.id,
    after: { code: expense.code, amount: input.amount, kind: input.kind, accountId: input.accountId },
  });
  return expense.id;
}

/** A mistaken expense is voided by a reversal row dated today; the original stays on record. */
export async function voidExpense(id: string, reason: string, ctx: RequestContext) {
  await withTransaction((tx) => voidExpenseInTx(tx, ctx, id, reason));
  return getExpense(id);
}

export async function voidExpenseInTx(tx: Tx, ctx: RequestContext, id: string, reason: string) {
  await tx.$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`;
  const original = await tx.expense.findUnique({ where: { id }, include: { reversedBy: { select: { code: true } } } });
  if (!original) throw notFound("Expense");
  if (original.reversalOfId) throw new ApiError(409, "CANNOT_VOID_REVERSAL", "A void can't be voided. Record the expense again instead.");
  if (original.reversedBy) throw new ApiError(409, "ALREADY_VOIDED", `${original.code} was already voided by ${original.reversedBy.code}`);
  const today = resolveBusinessDate(undefined);
  await assertCashDaysOpen(tx, [{ accountId: original.accountId, businessDate: today }]);
  const reversal = await tx.expense.create({
    data: {
      code: await nextCode(tx, "EXP", 5),
      categoryId: original.categoryId,
      kind: original.kind,
      orderId: original.orderId,
      accountId: original.accountId,
      amount: original.amount,
      businessDate: today,
      reference: original.code,
      notes: reason,
      reversalOfId: original.id,
      createdById: ctx.userId,
    },
  });
  await recordAudit(tx, ctx, {
    action: "expense.voided",
    entity: "Expense",
    entityId: id,
    after: { code: original.code, reversal: reversal.code, reason },
  });
}
