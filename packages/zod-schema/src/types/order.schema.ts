import { z } from "zod";
import { uuidSchema, quantitySchema } from "./common";



export const cartItemSchema = z
  .object({
    productId: uuidSchema,
    variantId: uuidSchema.optional(),
    quantity: quantitySchema,
  })
  .strict();

  
/**
 * Payment method after the Cash on Delivery withdrawal.
 *
 * Kept permissive on input and narrow on output: a legacy client may still POST
 * "COD", and answering that with a 400 would strand it on an unusable checkout
 * screen. Parsing always yields "ONLINE", so nothing downstream can create a new
 * COD order. Existing COD orders are untouched — this only governs new intent.
 */
export const retiredCodPaymentMethod = z
  .enum(["ONLINE", "COD"])
  .default("ONLINE")
  .transform(() => "ONLINE" as const);


export const checkoutCalculateBodySchema = z
  .object({
    cartItems: z
      .array(cartItemSchema)
      .min(1, "Cart cannot be empty"),
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1).optional(),

    // Cash on Delivery has been withdrawn: every quote is prepaid. "COD" is still
    // *accepted* — mobile builds already on the stores send it — but collapsed to
    // ONLINE so a legacy client cannot be quoted a COD collection fee or rejected
    // by the prepaid-only pincode check for an order that will be paid online.
    paymentMethod: retiredCodPaymentMethod,
  })
  .strict();


export const createOrderBodySchema = z
  .object({
    cartItems: z
      .array(cartItemSchema)
      .min(1, "Cart cannot be empty"),
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1).optional(),

    // Always ONLINE — see retiredCodPaymentMethod.
    paymentMethod: retiredCodPaymentMethod,
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