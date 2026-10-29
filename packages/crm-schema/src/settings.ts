import { z } from "zod";
import { isoDate, listQuery, optionalText, percent, requiredText } from "./common";
import { LOCATION_TYPES, PAYMENT_METHODS, STATE_CODES } from "./enums";

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const businessProfileSchema = z.object({
  legalName: requiredText(120),
  tradeName: requiredText(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(GSTIN_PATTERN, "Enter a valid 15-character GSTIN").nullable())
    .nullish(),
  stateCode: z.enum(STATE_CODES),
  addressLine: requiredText(240),
  city: requiredText(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  phone: optionalText(20),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Enter a valid email").nullable())
    .nullish(),
  receiptFooter: optionalText(300),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

const locationFields = {
  name: requiredText(60),
  type: z.enum(LOCATION_TYPES),
  address: optionalText(240),
  isActive: z.boolean(),
};

export const createLocationSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,19}$/, "2–20 letters, digits or _ (e.g. STORE)"),
  ...locationFields,
  isActive: locationFields.isActive.default(true),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z.object(locationFields).partial();
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

const accountFields = {
  name: requiredText(60),
  method: z.enum(PAYMENT_METHODS),
  isPersonal: z.boolean(),
  feePercent: percent,
  details: optionalText(120),
  isActive: z.boolean(),
};

export const createReceivingAccountSchema = z.object({
  ...accountFields,
  isPersonal: accountFields.isPersonal.default(false),
  feePercent: accountFields.feePercent.default("0"),
  isActive: accountFields.isActive.default(true),
});
export type CreateReceivingAccountInput = z.infer<typeof createReceivingAccountSchema>;

export const updateReceivingAccountSchema = z.object(accountFields).partial();
export type UpdateReceivingAccountInput = z.infer<typeof updateReceivingAccountSchema>;

export const auditListQuery = listQuery.extend({
  entity: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  userId: z.string().uuid().optional(),
  action: z.string().trim().max(60).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;
