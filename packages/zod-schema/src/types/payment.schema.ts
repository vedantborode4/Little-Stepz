import { z } from "zod";
import { uuidSchema } from "./common";

export const createPaymentBodySchema = z
  .object({
    orderId: uuidSchema,
  })
  .strict();

export const verifyPaymentBodySchema = z
  .object({
    razorpayOrderId:   z.string().min(1, "Razorpay order ID required").max(100),
    razorpayPaymentId: z.string().min(1, "Razorpay payment ID required").max(100),
    razorpaySignature: z.string().min(1, "Razorpay signature required").max(512),
    orderId:           uuidSchema,
  })
  .strict();

export const createReturnBodySchema = z
  .object({
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Reason too long"),
    description: z.string().max(2000).optional(),
  })
  .strict();

export const resolveReturnBodySchema = z
  .object({
    status:       z.enum(["APPROVED", "REJECTED"]),
    adminNote:    z.string().max(1000).optional(),
    refundAmount: z.number().positive().optional(), // Override calculated amount
  })
  .strict();

export const trackOrderParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();

export const serviceabilityQuerySchema = z
  .object({
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  })
  .strict();

export const razorpayWebhookBodySchema = z.object({
  entity:   z.string(),
  event:    z.string(),
  payload:  z.object({
    payment: z
      .object({
        entity: z.object({
          id:          z.string(),
          order_id:    z.string(),
          amount:      z.number(),
          currency:    z.string(),
          status:      z.string(),
          description: z.string().optional(),
          notes:       z.record(z.string(),z.string().optional()).optional(),
          error_code:  z.string().optional(),
          error_description: z.string().optional(),
        }),
      })
      .optional(),
    refund: z
      .object({
        entity: z.object({
          id:         z.string(),
          payment_id: z.string(),
          amount:     z.number(),
          status:     z.string(),
          notes:      z.record(z.string(),z.string().optional()).optional(),
        }),
      })
      .optional(),
  }),
});

/**
 * Recording a balance an admin collected outside the gateway — cash handed over, a bank
 * transfer, a UPI payment taken by hand.
 *
 * `reference` is free text on purpose: it is whatever lets a human reconcile the entry
 * later (a UTR, a receipt number, a driver's name). It is not validated because nothing
 * downstream parses it.
 */
export const markBalancePaidBodySchema = z
  .object({
    method:    z.enum(["CASH", "BANK_TRANSFER", "UPI", "OTHER"]),
    reference: z.string().trim().max(120).optional(),
    note:      z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * Writing off a balance that will never be collected. The reason is required and
 * constrained, because it is what the customer-facing forfeiture notice quotes and what
 * the P&L needs in order to tell an RTO apart from a customer who simply refused.
 */
export const writeOffBalanceBodySchema = z
  .object({
    reason: z.enum(["REFUSED_DELIVERY", "RTO", "CANCELLED_BY_CUSTOMER", "UNCOLLECTABLE", "OTHER"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type WriteOffBalanceBody    = z.infer<typeof writeOffBalanceBodySchema>;
export type MarkBalancePaidBody    = z.infer<typeof markBalancePaidBodySchema>;
export type CreatePaymentBody      = z.infer<typeof createPaymentBodySchema>;
export type VerifyPaymentBody      = z.infer<typeof verifyPaymentBodySchema>;
export type CreateReturnBody       = z.infer<typeof createReturnBodySchema>;
export type ResolveReturnBody      = z.infer<typeof resolveReturnBodySchema>;
export type TrackOrderParams       = z.infer<typeof trackOrderParamsSchema>;
export type ServiceabilityQuery    = z.infer<typeof serviceabilityQuerySchema>;
export type RazorpayWebhookBody    = z.infer<typeof razorpayWebhookBodySchema>;