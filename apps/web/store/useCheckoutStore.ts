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

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  resetSession: () => set({ _idempotencyKey: null, placingOrder: false }),

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

    // ── Stable idempotency key: reuse if already set for this session ────
    // This means repeated clicks / retries all send the SAME key, so the
    // backend deduplicates them instead of creating multiple orders.
    let idempotencyKey = get()._idempotencyKey
    if (!idempotencyKey) {
      idempotencyKey = generateKey()
      set({ _idempotencyKey: idempotencyKey })
    }

    set({ placingOrder: true })

    try {
      // ── Step 1: Create order ─────────────────────────────────────────
      const cartItems = items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      }))

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
        set({ placingOrder: false, _idempotencyKey: null })
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
              set({ placingOrder: false, _idempotencyKey: null })
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
      toast.error(friendlyError(err, "Something went wrong. Please try again."))
      set({ placingOrder: false })
      return null
    }
  },
}))