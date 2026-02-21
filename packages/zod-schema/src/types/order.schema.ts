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

    // Payment method chosen at order creation time
    paymentMethod: z.enum(["ONLINE", "COD"]).default("ONLINE"),
    customerNote: z.string().max(500).optional(),
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

export type CartItem = z.infer<typeof cartItemSchema>;
export type CheckoutCalculateBody = z.infer<typeof checkoutCalculateBodySchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;