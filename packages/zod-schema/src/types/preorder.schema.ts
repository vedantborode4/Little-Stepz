import { z } from "zod";
import { uuidSchema, quantitySchema } from "./common";

export const createPreOrderSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  quantity: quantitySchema.default(1),
  addressId: uuidSchema,
});

export const verifyPreOrderPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const preOrderParamsSchema = z.object({
  id: uuidSchema,
});

export const balanceTokenParamsSchema = z.object({
  token: z.string().min(10),
});

export type CreatePreOrderData = z.infer<typeof createPreOrderSchema>;
export type VerifyPreOrderPaymentData = z.infer<typeof verifyPreOrderPaymentSchema>;
export type BalanceTokenParams = z.infer<typeof balanceTokenParamsSchema>;
