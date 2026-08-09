import { create } from "zustand"
import { CheckoutService } from "../lib/services/checkout.service"
import { useCartStore } from "./useCartStore"
import { toast } from "sonner"
import { friendlyError } from "../lib/errorMessages"

interface CheckoutState {
  placingOrder: boolean
  paymentMethod: "COD" | "ONLINE"
  // Stable idempotency key — generated once per checkout session,
  // cleared after a successful order so a fresh one is used next time.
  _idempotencyKey: string | null
  // Cart+address+coupon fingerprint the key was minted for; editing the cart
  // must start a new order rather than silently replay the old one.
  _keySignature: string | null

  setPaymentMethod: (method: "COD" | "ONLINE") => void
  placeOrder: (addressId: string) => Promise<string | null>
  resetSession: () => void
}

function generateKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  placingOrder: false,
  paymentMethod: "COD",
  _idempotencyKey: null,
  _keySignature: null,

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  resetSession: () => set({ _idempotencyKey: null, _keySignature: null, placingOrder: false }),

  placeOrder: async (addressId: string) => {
    // ── Guard: prevent concurrent calls ─────────────────────────────────
    if (get().placingOrder) return null

    const { paymentMethod } = get()
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
    const signature = JSON.stringify({ addressId, couponCode: couponCode || null, cartItems })
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
        idempotencyKey
      )

      // ── Step 2a: COD ─────────────────────────────────────────────────
      if (paymentMethod === "COD") {
        await CheckoutService.confirmCod(orderId)
        toast.success("Order placed successfully 🎉")
        // Clear session so a future checkout gets a fresh key
        set({ placingOrder: false, _idempotencyKey: null, _keySignature: null })
        return orderId
      }

      // ── Step 2b: Online — open Razorpay ──────────────────────────────
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
          description: "Order Payment",

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
              toast.error(friendlyError(err, "Payment verification failed"))
              set({ placingOrder: false })
              resolve(null)
            }
          },

          modal: {
            ondismiss: () => {
              toast.error("Payment cancelled")
              set({ placingOrder: false })
              resolve(null)
            },
          },

          theme: { color: "#FF383C" },
        }

        const rzp = new (window as any).Razorpay(options)

        rzp.on("payment.failed", (response: any) => {
          toast.error(
            response?.error?.description || "Payment failed. Please try again."
          )
          set({ placingOrder: false })
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
      toast.error(friendlyError(err, "Something went wrong. Please try again."))
      set({ placingOrder: false })
      return null
    }
  },
}))