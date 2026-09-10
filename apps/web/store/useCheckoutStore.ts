import { create } from "zustand"
import { CheckoutService } from "../lib/services/checkout.service"
import { useCartStore } from "./useCartStore"
import { toast } from "sonner"
import { friendlyError } from "../lib/errorMessages"

export type PaymentPlan = "FULL" | "PARTIAL"
/** ONLINE for both online plans; COD for Cash on Delivery, which is always a FULL plan. */
export type PaymentMethod = "ONLINE" | "COD"
/** The single choice the checkout offers, mapped onto plan + method. */
export type PaymentChoice = "FULL" | "PARTIAL" | "COD"

import type { CheckoutQuote } from "../lib/services/checkout.service"

interface CheckoutState {
  placingOrder: boolean
  /** Which plan the customer chose at step 3. */
  paymentPlan: PaymentPlan
  paymentMethod: PaymentMethod
  /** Whether they ticked the deposit-forfeiture acknowledgement. */
  forfeitureAck: boolean
  /**
   * The server quote, shared rather than re-fetched.
   *
   * CheckoutSummary owns the request (it always has); the plan chooser needs the same
   * numbers, and a second fetch would be both wasteful and a chance for the two to
   * disagree about the deposit for a moment.
   */
  quote: CheckoutQuote | null
  // Stable idempotency key — generated once per checkout session,
  // cleared after a successful order so a fresh one is used next time.
  _idempotencyKey: string | null
  // Cart+address+coupon fingerprint the key was minted for; editing the cart
  // must start a new order rather than silently replay the old one.
  _keySignature: string | null

  setQuote: (quote: CheckoutQuote | null) => void
  setPaymentPlan: (plan: PaymentPlan) => void
  setPaymentChoice: (choice: PaymentChoice) => void
  setForfeitureAck: (ack: boolean) => void
  placeOrder: (addressId: string) => Promise<string | null>
  resetSession: () => void
}

function generateKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Hand the order's stock back the moment the customer walks away from payment.
 *
 * Deliberately fire-and-forget: the server-side sweeper reclaims this order anyway,
 * so a failed call costs a few minutes of held stock, not correctness. Nothing here
 * is allowed to delay the toast or block the UI.
 */
function releaseAbandonedOrder(orderId: string): void {
  void CheckoutService.abandonOrder(orderId).catch(() => {})
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  placingOrder: false,
  paymentPlan: "FULL",
  paymentMethod: "ONLINE",
  forfeitureAck: false,
  quote: null,
  _idempotencyKey: null,
  _keySignature: null,

  // A new quote can revoke eligibility (a different address, a coupon that pushed the
  // total over the cap), so the plan falls back rather than letting the customer submit
  // one the server will reject.
  setQuote: (quote) =>
    set((state) => {
      if (!quote) return { quote }
      if (state.paymentMethod === "COD" && !quote.codPayment?.eligible) {
        return { quote, paymentPlan: "FULL", paymentMethod: "ONLINE", forfeitureAck: false }
      }
      if (state.paymentPlan === "PARTIAL" && !quote.partialPayment?.eligible) {
        return { quote, paymentPlan: "FULL", forfeitureAck: false }
      }
      return { quote }
    }),

  // Changing the plan invalidates the acknowledgement: it was given against a specific
  // deposit amount, so it has to be re-given if that changes.
  setPaymentPlan: (plan) => set({ paymentPlan: plan, paymentMethod: "ONLINE", forfeitureAck: false }),
  setPaymentChoice: (choice) =>
    set(
      choice === "COD"
        ? { paymentPlan: "FULL", paymentMethod: "COD", forfeitureAck: false }
        : { paymentPlan: choice, paymentMethod: "ONLINE", forfeitureAck: false }
    ),
  setForfeitureAck: (ack) => set({ forfeitureAck: ack }),

  // `paymentPlan` deliberately survives this. resetSession fires on every step change
  // in the stepper, and wiping the customer's choice because they went back to edit
  // their address would be infuriating. The acknowledgement does not survive: it is
  // cheap to re-give and must always be a deliberate act.
  resetSession: () =>
    set({ _idempotencyKey: null, _keySignature: null, placingOrder: false, forfeitureAck: false }),

  placeOrder: async (addressId: string) => {
    // ── Guard: prevent concurrent calls ─────────────────────────────────
    if (get().placingOrder) return null

    const { items, couponCode } = useCartStore.getState()

    if (!addressId) {
      toast.error("Please select a delivery address")
      return null
    }
    if (!items.length) {
      toast.error("Your cart is empty")
      return null
    }

    const cartItems = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
    }))

    // ── Stable idempotency key: reuse while the cart is unchanged ────────
    // Repeated clicks / retries send the SAME key, so the backend dedupes them
    // instead of creating multiple orders. Editing the cart changes the
    // signature and starts a genuinely new order.
    // `paymentPlan` is part of the signature deliberately. Without it, switching plan
    // after an abandoned attempt replays the earlier order — charging the full amount to
    // someone who just chose to pay 20%, or the reverse.
    //
    // Place exactly what the page shows as selected. PaymentSection and CheckoutSummary
    // only mark COD or the deposit plan as chosen while the current quote offers it, so a
    // failed quote (setQuote(null)) reads as paying in full there and must here too —
    // otherwise "Proceed to Pay" would silently create a COD order.
    const { quote, forfeitureAck } = get()
    const paymentMethod: PaymentMethod =
      get().paymentMethod === "COD" && quote?.codPayment?.eligible ? "COD" : "ONLINE"
    const paymentPlan: PaymentPlan =
      paymentMethod === "ONLINE" && get().paymentPlan === "PARTIAL" && quote?.partialPayment?.eligible
        ? "PARTIAL"
        : "FULL"

    if (paymentPlan === "PARTIAL" && !forfeitureAck) {
      toast.error("Please confirm you understand the deposit is non-refundable.")
      return null
    }

    const signature = JSON.stringify({
      addressId,
      couponCode: couponCode || null,
      cartItems,
      paymentPlan,
      paymentMethod,
    })
    let idempotencyKey = get()._idempotencyKey
    if (!idempotencyKey || get()._keySignature !== signature) {
      idempotencyKey = generateKey()
      set({ _idempotencyKey: idempotencyKey, _keySignature: signature })
    }

    set({ placingOrder: true })

    try {
      // ── Step 1: Create order ─────────────────────────────────────────
      const { orderId } = await CheckoutService.createOrder(
        addressId,
        cartItems,
        couponCode || null,
        idempotencyKey,
        { paymentPlan, paymentMethod, acceptForfeitTerms: forfeitureAck }
      )

      // Cash on Delivery charges nothing now: confirm the order and stop. There is no
      // Razorpay sheet to open.
      if (paymentMethod === "COD") {
        try {
          await CheckoutService.confirmCod(orderId)
        } catch (err) {
          // The order exists but was not confirmed (another tab took the last open COD
          // slot, say) and is holding its stock. Release it now so the pay-online retry
          // does not fail as out of stock until the sweeper runs, and retire the key that
          // points at it. A confirmed order is left alone by the abandon endpoint.
          releaseAbandonedOrder(orderId)
          set({ _idempotencyKey: null, _keySignature: null })
          throw err
        }
        toast.success("Order placed — pay on delivery 🎉")
        set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
        return orderId
      }

      // ── Step 2: Open Razorpay ────────────────────────────────────────
      const rzpData = await CheckoutService.createRazorpayOrder(orderId)

      return new Promise<string | null>((resolve) => {
        if (typeof (window as any).Razorpay === "undefined") {
          toast.error("Payment gateway not loaded. Please refresh the page.")
          set({ placingOrder: false })
          return resolve(null)
        }

        const options = {
          key:      rzpData.keyId,
          amount:   rzpData.amount * 100,
          currency: rzpData.currency || "INR",
          order_id: rzpData.razorpayOrderId,
          name:     "Little Stepz",
          // Named so the sheet does not say "Order Payment" over a fifth of the order.
          description: paymentPlan === "PARTIAL" ? "Order deposit (20%)" : "Order Payment",

          handler: async (response: {
            razorpay_order_id: string
            razorpay_payment_id: string
            razorpay_signature: string
          }) => {
            try {
              await CheckoutService.verifyPayment({
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                orderId,
              })
              toast.success("Payment successful 🎉")
              set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
              resolve(orderId)
            } catch (err: any) {
              // Verify rejects with ORDER_NOT_PENDING when the payment landed on an
              // order that had already been cancelled and its stock released. The
              // backend refunds it, so say so — the generic mapping for that code
              // ("this order can no longer be changed") is alarming right after the
              // customer has watched money leave their account.
              const orphaned = err?.response?.data?.message === "ORDER_NOT_PENDING"
              toast.error(
                orphaned
                  ? "That checkout had expired, so your payment is being refunded. Please try again."
                  : friendlyError(err, "Payment verification failed")
              )
              set(
                orphaned
                  ? { placingOrder: false, _idempotencyKey: null, _keySignature: null }
                  : { placingOrder: false }
              )
              resolve(null)
            }
          },

          modal: {
            ondismiss: () => {
              releaseAbandonedOrder(orderId)
              toast.error("Payment cancelled")
              // The order is cancelled now, so the key pointing at it is spent —
              // clearing it makes the next attempt mint a fresh order rather than
              // replaying a dead one into an ORDER_NOT_PENDING error.
              set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
              resolve(null)
            },
          },

          // One order, one attempt. Razorpay's in-modal retry reuses the same
          // razorpay order, so a second attempt would land on an order the
          // payment.failed webhook has already cancelled and released stock for —
          // and get auto-refunded. Retrying instead restarts checkout on a fresh
          // order; the cart is untouched, so that's one extra tap.
          retry: { enabled: false },

          theme: { color: "#FF383C" },
        }

        const rzp = new (window as any).Razorpay(options)

        rzp.on("payment.failed", (response: any) => {
          releaseAbandonedOrder(orderId)
          toast.error(
            response?.error?.description || "Payment failed. Please try again."
          )
          set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
          resolve(null)
        })

        rzp.open()
      })
    } catch (err: any) {
      // The order this key points at is no longer payable — it was reclaimed after
      // being abandoned (see reclaimStalePendingOrders). Drop the spent key so the
      // next attempt starts a fresh order instead of replaying a cancelled one.
      if (err?.response?.data?.message === "ORDER_NOT_PENDING") {
        set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
        toast.error("That checkout expired. Please try again.")
        return null
      }

      // Eligibility lapsed between the quote and order creation. Fall back to paying in
      // full and STOP — silently charging the whole amount because pay-later disappeared
      // is the worst available outcome, so the customer has to re-confirm.
      const code = err?.response?.data?.message

      // Same for Cash on Delivery: fall back to paying online and stop, so the customer
      // re-confirms rather than being silently moved to a different way of paying.
      if (
        code === "COD_DISABLED" ||
        code === "COD_NOT_ELIGIBLE" ||
        code === "COD_ORDER_VALUE_EXCEEDED" ||
        code === "COD_LIMIT_REACHED" ||
        code === "COD_BLOCKED" ||
        code === "COD_PLAN_CONFLICT" ||
        code === "COD_NOT_AVAILABLE" ||
        code === "PAYMENT_METHOD_INVALID"
      ) {
        set({
          placingOrder: false,
          paymentPlan: "FULL",
          paymentMethod: "ONLINE",
          forfeitureAck: false,
          _idempotencyKey: null,
          _keySignature: null,
        })
        toast.error(friendlyError(err, "Cash on Delivery isn't available for this order."))
        return null
      }

      if (
        code === "PARTIAL_PAYMENT_NOT_ELIGIBLE" ||
        code === "PARTIAL_NOT_ELIGIBLE" ||
        code === "PARTIAL_ORDER_VALUE_EXCEEDED" ||
        code === "PARTIAL_LIMIT_REACHED" ||
        code === "PARTIAL_PAYMENT_DISABLED" ||
        code === "PARTIAL_AMOUNT_TOO_SMALL"
      ) {
        set({
          placingOrder: false,
          paymentPlan: "FULL",
          forfeitureAck: false,
          _idempotencyKey: null,
          _keySignature: null,
        })
        toast.error(friendlyError(err, "Pay-later is no longer available for this order."))
        return null
      }

      toast.error(friendlyError(err, "Something went wrong. Please try again."))
      set({ placingOrder: false })
      return null
    }
  },
}))