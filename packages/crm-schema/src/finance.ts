import { z } from "zod";
import { isoDate, listQuery, money, optionalFilterId, optionalText, requiredText } from "./common";

/** OPERATING: running the business (rent, salaries). ORDER: spent on one order (packaging, extra courier). */
export const EXPENSE_KINDS = ["OPERATING", "ORDER"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];
export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  OPERATING: "Operating expense",
  ORDER: "For an order",
};

export const CASH_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];
export const CASH_SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = { OPEN: "Open", CLOSED: "Closed" };

/** Suggested categories; the owner can add or rename them. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Electricity",
  "Packaging",
  "Courier",
  "Marketing",
  "Repairs",
  "Tea & snacks",
  "Other",
];

const positiveMoney = money.refine((v) => Number(v) > 0, "Must be greater than 0");

export const expenseCategorySchema = z.object({ name: requiredText(60), isActive: z.boolean().default(true) });
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export const updateExpenseCategorySchema = z.object({ name: requiredText(60), isActive: z.boolean() }).partial();
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const createExpenseSchema = z
  .object({
    categoryId: z.string().uuid("Choose a category"),
    kind: z.enum(EXPENSE_KINDS).default("OPERATING"),
    orderId: z
      .union([z.literal(""), z.string().uuid()])
      .transform((v) => v || null)
      .nullish(),
    /** The account the money was paid from. */
    accountId: z.string().uuid("Choose the account it was paid from"),
    amount: positiveMoney,
    businessDate: isoDate.optional(),
    vendor: optionalText(80),
    reference: optionalText(80),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "ORDER" && !v.orderId)
      ctx.addIssue({ code: "custom", path: ["orderId"], message: "Choose the order this was spent on" });
  });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const voidExpenseSchema = z.object({ reason: requiredText(200) });

export const expenseListQuery = listQuery.extend({
  categoryId: optionalFilterId,
  kind: z.enum(EXPENSE_KINDS).optional(),
  accountId: optionalFilterId,
  orderId: optionalFilterId,
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuery>;

export const cashDayQuery = z.object({ accountId: z.string().uuid(), date: isoDate });
export type CashDayQuery = z.infer<typeof cashDayQuery>;

export const openCashDaySchema = z.object({
  accountId: z.string().uuid("Choose the cash drawer"),
  businessDate: isoDate.optional(),
  /** Cash in the drawer at the start; blank = what was counted at the last close. */
  openingAmount: z
    .union([z.literal(""), z.null(), money])
    .transform((v) => (v === "" ? null : v))
    .optional(),
});
export type OpenCashDayInput = z.infer<typeof openCashDaySchema>;

export const closeCashDaySchema = z.object({ countedAmount: money, notes: optionalText(500) });
export type CloseCashDayInput = z.infer<typeof closeCashDaySchema>;

export const reopenCashDaySchema = z.object({ reason: requiredText(200) });

export const cashSessionListQuery = listQuery.extend({
  accountId: optionalFilterId,
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type CashSessionListQuery = z.infer<typeof cashSessionListQuery>;
