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
 * How the order is paid: online through Razorpay, or in cash to the courier.
 *
 * This collapsed every input to ONLINE while Cash on Delivery was withdrawn. COD is back,
 * so it is honoured again. Its eligibility gates — per-product toggle, courier
 * serviceability, order-value cap, open-order limit and refused-delivery block — are
 * enforced server-side at order creation and again at confirmation, never trusted to the
 * client. Defaults to ONLINE, so clients that never send it are unchanged.
 */
export const paymentMethodSchema = z.enum(["ONLINE", "COD"]).default("ONLINE");

/** @deprecated COD is no longer retired — use `paymentMethodSchema`. */
export const retiredCodPaymentMethod = paymentMethodSchema;


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

    // Informational on a quote: COD and deposit eligibility are both returned whichever
    // method is sent, so one call renders every option.
    paymentMethod: paymentMethodSchema,

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

    paymentMethod: paymentMethodSchema,
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
