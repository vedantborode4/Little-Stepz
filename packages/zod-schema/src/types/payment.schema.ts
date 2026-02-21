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

export const createCodPaymentBodySchema = z
  .object({
    orderId: uuidSchema,
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

export type CreatePaymentBody      = z.infer<typeof createPaymentBodySchema>;
export type VerifyPaymentBody      = z.infer<typeof verifyPaymentBodySchema>;
export type CreateCodPaymentBody   = z.infer<typeof createCodPaymentBodySchema>;
export type CreateReturnBody       = z.infer<typeof createReturnBodySchema>;
export type ResolveReturnBody      = z.infer<typeof resolveReturnBodySchema>;
export type TrackOrderParams       = z.infer<typeof trackOrderParamsSchema>;
export type RazorpayWebhookBody    = z.infer<typeof razorpayWebhookBodySchema>;