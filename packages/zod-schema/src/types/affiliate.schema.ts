import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common";

export const affiliateApplySchema = z
  .object({
    // Optional: reason/pitch for becoming affiliate
    message: z.string().min(20, "Please provide a brief message (min 20 chars)").max(1000).optional(),
  })
  .strict();

export const affiliatePayoutDetailsSchema = z
  .object({
    accountHolder: z.string().min(2).max(100),
    accountNumber: z.string().min(6).max(20).regex(/^\d+$/, "Account number must be digits only"),
    ifsc:          z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
    bankName:      z.string().min(2).max(100),
    upiId:         z.string().email("Invalid UPI ID format").optional(),
  })
  .strict();

export const affiliateWithdrawSchema = z
  .object({
    amount: z.number().positive().min(100, "Minimum withdrawal is ₹100"),
  })
  .strict();

export const affiliateClicksQuerySchema = paginationSchema.extend({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
  unique: z.enum(["true", "false"]).transform(v => v === "true").optional(),
});

export const affiliateConversionsQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
});

export const affiliateCommissionsQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
});

export const affiliateOrdersQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
      "DELIVERED", "CANCELLED", "REFUNDED",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
});

export const referralCodeParamSchema = z.object({
  referralCode: z
    .string()
    .min(4)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Invalid referral code format"),
});

export const adminAffiliateApproveSchema = z
  .object({
    status:        z.enum(["APPROVED", "REJECTED"]),
    commissionRate: z
      .number()
      .min(0.01, "Min 1%")
      .max(0.20, "Max 20%")
      .optional(),
    commissionType: z.enum(["PER_ORDER", "LIFETIME"]).optional(),
    adminNote:     z.string().max(500).optional(),
  })
  .strict();

export const adminProcessWithdrawalSchema = z
  .object({
    status:         z.enum(["PAID", "REJECTED"]),
    transactionRef: z.string().max(100).optional(),
    adminNote:      z.string().max(500).optional(),
  })
  .strict();

export type AffiliateApplyBody           = z.infer<typeof affiliateApplySchema>;
export type AffiliatePayoutDetailsBody   = z.infer<typeof affiliatePayoutDetailsSchema>;
export type AffiliateWithdrawBody        = z.infer<typeof affiliateWithdrawSchema>;
export type AffiliateClicksQuery         = z.infer<typeof affiliateClicksQuerySchema>;
export type AffiliateConversionsQuery    = z.infer<typeof affiliateConversionsQuerySchema>;
export type AffiliateCommissionsQuery    = z.infer<typeof affiliateCommissionsQuerySchema>;
export type AffiliateOrdersQuery         = z.infer<typeof affiliateOrdersQuerySchema>;
export type ReferralCodeParam            = z.infer<typeof referralCodeParamSchema>;
export type AdminAffiliateApproveBody    = z.infer<typeof adminAffiliateApproveSchema>;
export type AdminProcessWithdrawalBody   = z.infer<typeof adminProcessWithdrawalSchema>;
