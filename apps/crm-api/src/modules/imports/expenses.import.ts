import { prisma } from "@repo/crm-db/client";
import { fromDbDate, todayIST, toDbDate } from "../../core/dates";
import { dec, Decimal } from "../../core/money";
import { nameKey } from "../../core/sequence";
import { createExpenseInTx, voidExpenseInTx } from "../expenses/expenses.service";
import { amountCell, dateCell, duplicate, fail, inr, matchAccount, ok, type Created, type KindHandler, type Unit } from "./import-shared";

interface ExpensePayload {
  categoryId: string;
  accountId: string;
  amount: string;
  businessDate: string;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
}

const text = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max) || null;

/** Running costs paid on their own dates (setup costs, rent…). Rolling back voids them, as any expense is corrected. */
export const expensesImport: KindHandler<ExpensePayload> = {
  async check(rows) {
    const results = rows.map(ok);
    const [categories, accounts] = await Promise.all([
      prisma.expenseCategory.findMany({ where: { isActive: true }, select: { id: true, name: true, nameKey: true } }),
      prisma.receivingAccount.findMany({ where: { isActive: true }, select: { id: true, name: true, method: true } }),
    ]);
    const categoryByKey = new Map(categories.map((c) => [c.nameKey, c]));
    const today = todayIST();

    const parsed = rows.map((row, i) => {
      const r = results[i]!;
      const f = row.fields;
      const date = dateCell(f.date);
      if (date === null) fail(r, "Date paid: Required");
      else if (date === false) fail(r, "Date paid: not a date");
      else if (date > today) fail(r, "Date paid: can't be in the future");

      const category = categoryByKey.get(nameKey(f.category ?? ""));
      if (!(f.category ?? "").trim()) fail(r, "Expense category: Required");
      else if (!category) fail(r, `Expense category: "${f.category}" doesn't exist; add it under Expenses first`);

      const amount = amountCell(f.amount);
      if (amount === null) fail(r, "Amount: Required");
      else if (amount === false || dec(amount).lte(0)) fail(r, "Amount: an amount above 0 with at most 2 decimals");

      let accountId: string | null = null;
      if (!(f.account ?? "").trim()) fail(r, "Paid from: Required");
      else {
        const match = matchAccount(accounts, f.account!);
        if ("error" in match) fail(r, `Paid from: ${match.error}`);
        else accountId = match.account.id;
      }

      return r.status === "VALID"
        ? {
            categoryId: category!.id,
            accountId: accountId!,
            amount: amount as string,
            businessDate: date as string,
            vendor: text(f.vendor, 80),
            reference: text(f.reference, 80),
            notes: text(f.description, 500),
          }
        : null;
    });

    const ready = parsed.filter((p): p is ExpensePayload => p !== null);
    const [existing, closed] = await Promise.all([
      prisma.expense.findMany({
        where: {
          reversalOfId: null,
          reversedBy: { is: null },
          businessDate: { in: [...new Set(ready.map((p) => p.businessDate))].map(toDbDate) },
        },
        select: { code: true, categoryId: true, amount: true, businessDate: true, notes: true },
      }),
      prisma.cashSession.findMany({
        where: { status: "CLOSED", accountId: { in: [...new Set(ready.map((p) => p.accountId))] } },
        select: { accountId: true, businessDate: true, account: { select: { name: true } } },
      }),
    ]);
    const sameAs = (p: ExpensePayload) =>
      existing.find(
        (e) =>
          e.categoryId === p.categoryId &&
          fromDbDate(e.businessDate) === p.businessDate &&
          e.amount.eq(p.amount) &&
          (p.notes === null || e.notes === p.notes),
      );
    const closedDay = new Map(closed.map((s) => [`${s.accountId}|${fromDbDate(s.businessDate)}`, s.account.name]));

    const units: Unit<ExpensePayload>[] = [];
    parsed.forEach((p, i) => {
      const r = results[i]!;
      if (!p) return;
      const day = closedDay.get(`${p.accountId}|${p.businessDate}`);
      if (day) fail(r, `The cash day ${p.businessDate} is closed for ${day}; reopen it first`);
      const twin = sameAs(p);
      if (twin) duplicate(r, `Same date, category, amount and description as ${twin.code}`);
      if (r.status === "VALID") units.push({ rows: [i], payload: p });
    });

    const total = units.reduce((s, u) => s.add(dec(u.payload.amount)), new Decimal(0));
    const summary = units.length
      ? [
          `${units.length} expense(s) totalling ${inr(total)}, from ${units.map((u) => u.payload.businessDate).sort()[0]} to ${units
            .map((u) => u.payload.businessDate)
            .sort()
            .at(-1)}.`,
        ]
      : [];
    return { results, units, summary };
  },

  async create(tx, ctx, batch, units) {
    const entities: Created["entities"] = new Map();
    for (const { rows, payload } of units) {
      const id = await createExpenseInTx(tx, ctx, {
        ...payload,
        kind: "OPERATING",
        notes: payload.notes ?? `Imported from ${batch.code}`,
        reference: payload.reference ?? batch.code,
      });
      entities.set(rows[0]!, { entity: "Expense", id });
    }
    return { entities };
  },

  async lockForRollback(tx, _batch, rows) {
    const ids = rows.filter((r) => r.createdEntity === "Expense").map((r) => r.createdEntityId!);
    for (const id of [...ids].sort()) await tx.$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`;
  },

  async rollbackBlocker() {
    return null;
  },

  async rollback(tx, ctx, batch, rows, reason) {
    const ids = rows.filter((r) => r.createdEntity === "Expense").map((r) => r.createdEntityId!);
    const voided = await tx.expense.findMany({ where: { reversalOfId: { in: ids } }, select: { reversalOfId: true } });
    const already = new Set(voided.map((v) => v.reversalOfId));
    for (const id of ids) if (!already.has(id)) await voidExpenseInTx(tx, ctx, id, `Import ${batch.code} rolled back: ${reason}`);
  },
};
