import { z } from "zod";
import { uuidSchema, quantitySchema } from "./common";



export const cartItemSchema = z
  .object({
    productId: uuidSchema,
    variantId: uuidSchema.optional(),
    quantity: quantitySchema,
  })
  .strict();

  
export const checkoutCalculateBodySchema = z
  .object({
    cartItems: z
      .array(cartItemSchema)
      .min(1, "Cart cannot be empty"),
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1).optional(),
  })
  .strict();


export const createOrderBodySchema = z
  .object({
    cartItems: z
      .array(cartItemSchema)
      .min(1, "Cart cannot be empty"),
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1).optional(),

    // order-specific fields
    paymentMethodId: uuidSchema,
  })
  .strict();


export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]),
  })
  .strict();

export const orderParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();