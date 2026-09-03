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


/**
 * How the customer chose to pay.
 *
 * Deliberately a separate field from `paymentMethod` rather than a third member of it:
 * `paymentMethod` describes the gateway (a partial order's deposit is a genuine ONLINE
 * Razorpay capture), while this describes the schedule. Both storefronts branch on
 * `paymentMethod !== "COD"` to decide whether to show refund copy, so overloading it would
 * break unrelated screens — and published mobile builds would render a value they have no
 * label for.
 *
 * Defaults to FULL so clients that predate partial payment keep working unchanged.
 */
export const paymentPlanSchema = z.enum(["FULL", "PARTIAL"]).default("FULL");


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

    // The quote returns partial-payment eligibility regardless of what is requested, so
    // the checkout can render both options from a single call.
    paymentPlan: paymentPlanSchema,
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
    paymentPlan: paymentPlanSchema,
    customerNote: z.string().max(500).optional(),

    /**
     * Explicit acknowledgement that the deposit is forfeited if the customer cancels or
     * refuses delivery. Required for a PARTIAL order, enforced server-side rather than
     * trusted to the UI: it is the record that the term was shown and accepted, which is
     * what a chargeback dispute turns on.
     */
    acceptForfeitTerms: z.boolean().optional(),
  })
  .strict();


export const updateOrderStatusBodySchema = z
  .object({
    // Every status the admin transition map allows. PROCESSING and OUT_FOR_DELIVERY
    // were missing, so the panel's own buttons for them were rejected here — and since
    // the map requires OUT_FOR_DELIVERY before DELIVERED, an order the courier does not
    // report on (a local delivery) could never be completed at all. Legality is still
    // decided by `statusTransitions` in the service; this only stops the schema from
    // refusing values that map already governs.
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ]),

    /**
     * Who initiated a cancellation. Required when cancelling a partial-payment order,
     * because the two cases have opposite money outcomes — a merchant cancellation
     * refunds the deposit in full, a customer one forfeits it — and this endpoint is the
     * only admin cancel there is. Without it an admin cancelling on a customer's behalf
     * would silently refund a deposit that policy says is retained, with no way to tell
     * afterwards which was meant.
     */
    cancellationParty: z.enum(["MERCHANT", "CUSTOMER"]).optional(),
  })
  .strict();

export const orderParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();

export type PaymentPlan = z.infer<typeof paymentPlanSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type CheckoutCalculateBody = z.infer<typeof checkoutCalculateBodySchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;

/** PATCH-style toggle for local (hand) fulfilment vs Delhivery. */
export const setFulfilmentModeBodySchema = z
  .object({ manual: z.boolean() })
  .strict();

export type SetFulfilmentModeBody = z.infer<typeof setFulfilmentModeBodySchema>;
