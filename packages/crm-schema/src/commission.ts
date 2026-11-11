import { z } from "zod";
import { isoDate, money, optionalId, optionalText, percent, requiredText } from "./common";

/** Commission payouts are expenses in this category (created by the migration). */
export const COMMISSION_EXPENSE_CATEGORY = "Staff commission";

const staffCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Required")
  .max(20)
  .regex(/^[A-Z0-9-]+$/, "Letters, digits and dashes only");

const salespersonFields = {
  staffCode,
  name: requiredText(80),
  /** % of a sale's goods value excluding GST. */
  commissionRate: percent,
  isActive: z.boolean(),
};

export const createSalespersonSchema = z.object({ ...salespersonFields, isActive: salespersonFields.isActive.default(true) });
export type CreateSalespersonInput = z.infer<typeof createSalespersonSchema>;
export const updateSalespersonSchema = z.object(salespersonFields).partial();
export type UpdateSalespersonInput = z.infer<typeof updateSalespersonSchema>;

/** Put a salesperson on a sale, change them, or clear them (null). */
export const setOrderSalespersonSchema = z.object({ salespersonId: optionalId });
export type SetOrderSalespersonInput = z.infer<typeof setOrderSalespersonSchema>;

export const commissionQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { path: ["to"], message: "Must be on or after the start date" });
export type CommissionQuery = z.infer<typeof commissionQuery>;

export const commissionPayoutSchema = z.object({
  salespersonId: z.string().uuid("Choose the salesperson"),
  /** The account the money was paid from. */
  accountId: z.string().uuid("Choose the account it was paid from"),
  amount: money.refine((v) => Number(v) > 0, "Must be greater than 0"),
  businessDate: isoDate.optional(),
  reference: optionalText(80),
  notes: optionalText(500),
});
export type CommissionPayoutInput = z.infer<typeof commissionPayoutSchema>;
