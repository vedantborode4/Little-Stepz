import { z } from "zod";
import { listQuery, money, optionalText, requiredText } from "./common";
import { STATE_CODES } from "./enums";

export const CUSTOMER_TYPES = ["RETAIL", "WHOLESALE"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
};

/**
 * Normalises a phone number to E.164 so "98765 43210", "098765-43210" and
 * "+91 98765 43210" are the same customer. Bare numbers are taken as Indian
 * mobiles; anything else must carry its country code. Returns null when invalid.
 */
export function normalizeMobile(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (!/^\d{8,15}$/.test(rest)) return null;
    if (rest.startsWith("91") && !/^91[6-9]\d{9}$/.test(rest)) return null;
    return `+${rest}`;
  }
  if (!/^\d+$/.test(digits)) return null;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

/** "+919876543210" → "+91 98765 43210"; other countries are left as entered. */
export function formatMobile(e164: string): string {
  const india = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return india ? `+91 ${india[1]} ${india[2]}` : e164;
}

const MOBILE_ERROR = "Enter a valid mobile number (10 digits, or with +country code)";

const optionalMobile = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const normalized = normalizeMobile(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: MOBILE_ERROR });
      return z.NEVER;
    }
    return normalized;
  })
  .nullish();

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("Enter a valid email").nullable())
  .nullish();

const optionalPincode = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .string()
      .regex(/^\d{6}$/, "Enter a 6-digit PIN code")
      .nullable(),
  )
  .nullish();

const optionalState = z
  .union([z.literal(""), z.enum(STATE_CODES)])
  .transform((v) => (v === "" ? null : v))
  .nullish();

const optionalCreditDays = z
  .union([z.literal(""), z.null(), z.coerce.number().int("Whole days only").min(0).max(365, "At most 365 days")])
  .transform((v) => (v === "" ? null : v))
  .optional();

const optionalMoney = z
  .union([z.literal(""), z.null(), money])
  .transform((v) => (v === "" ? null : v))
  .optional();

const customerFields = {
  name: requiredText(120),
  mobile: optionalMobile,
  whatsapp: optionalMobile,
  email: optionalEmail,
  addressLine: optionalText(240),
  city: optionalText(80),
  stateCode: optionalState,
  pincode: optionalPincode,
  type: z.enum(CUSTOMER_TYPES),
  /** Days the customer may take to pay; null = pay on purchase. */
  creditDays: optionalCreditDays,
  creditLimit: optionalMoney,
  notes: optionalText(1000),
  isActive: z.boolean(),
};

export const createCustomerSchema = z.object({
  ...customerFields,
  type: customerFields.type.default("RETAIL"),
  isActive: customerFields.isActive.default(true),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object(customerFields).partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerListQuery = listQuery.extend({
  type: z.enum(CUSTOMER_TYPES).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Exports only: full contact details instead of masked ones (admin, audited). */
  contacts: z.enum(["masked", "full"]).default("masked"),
});
export type CustomerListQuery = z.infer<typeof customerListQuery>;

export const duplicateCheckQuery = z.object({
  name: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(30).optional(),
  pincode: z.string().trim().max(10).optional(),
  excludeId: z.string().uuid().optional(),
});
export type DuplicateCheckQuery = z.infer<typeof duplicateCheckQuery>;

export const mergeCustomerSchema = z.object({
  /** The customer that is kept; the one in the URL is folded into it. */
  intoId: z.string().uuid("Choose the customer to keep"),
  reason: requiredText(200),
});
export type MergeCustomerInput = z.infer<typeof mergeCustomerSchema>;

export const customerPriceSchema = z.object({
  price: money.refine((v) => Number(v) > 0, "Price must be greater than 0"),
});
export type CustomerPriceInput = z.infer<typeof customerPriceSchema>;

export const DUPLICATE_REASONS = ["MOBILE", "NAME_AND_PIN", "SIMILAR_NAME"] as const;
export type DuplicateReason = (typeof DUPLICATE_REASONS)[number];
export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  MOBILE: "Same mobile number",
  NAME_AND_PIN: "Same name and PIN code",
  SIMILAR_NAME: "Similar name",
};
