import { z } from "zod";
import { uuidSchema, quantitySchema, optionalSessionIdSchema, optionalUuidSchema } from "./common";

export const addCartItemBodySchema = z.object({
  productId: uuidSchema,
  variantId: optionalUuidSchema,
  quantity: quantitySchema,
});

export const updateCartItemBodySchema = z.object({
  productId: uuidSchema,
  variantId: optionalUuidSchema,
  quantity: quantitySchema,
});

export const removeCartItemBodySchema = z.object({
  productId: uuidSchema,
  variantId: optionalUuidSchema
});

export const syncCartBodySchema = z.object({
  sessionId: optionalSessionIdSchema,
});

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;
export type RemoveCartItemBody = z.infer<typeof removeCartItemBodySchema>;
export type SyncCartBody = z.infer<typeof syncCartBodySchema>;