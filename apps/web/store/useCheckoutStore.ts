import { create } from "zustand"
import { CheckoutService } from "../lib/services/checkout.service"
import { useCartStore } from "./useCartStore"
import { toast } from "sonner"

interface CheckoutState {
  placingOrder: boolean
  paymentMethod: "COD" | "ONLINE"

  setPaymentMethod: (method: "COD" | "ONLINE") => void
  placeOrder: (addressId: string) => Promise<string | null>
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  placingOrder: false,
  paymentMethod: "COD",

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  placeOrder: async (addressId: string) => {
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

    set({ placingOrder: true })

    try {
      // ── Step 1: Create order ─────────────────────────────────────────────
      const cartItems = items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      }))

      const { orderId } = await CheckoutService.createOrder(
        addressId,
        cartItems,
        couponCode || null
      )

      // ── Step 2a: COD ─────────────────────────────────────────────────────
      if (paymentMethod === "COD") {
        await CheckoutService.confirmCod(orderId)
        toast.success("Order placed successfully 🎉")
        set({ placingOrder: false })
        return orderId
      }

      // ── Step 2b: Online — create Razorpay order ───────────────────────────
      const rzpData = await CheckoutService.createRazorpayOrder(orderId)

      // Return a Promise that resolves when the Razorpay modal completes
      return new Promise<string | null>((resolve) => {
        if (typeof (window as any).Razorpay === "undefined") {
          toast.error("Payment gateway not loaded. Please refresh the page.")
          set({ placingOrder: false })
          return resolve(null)
        }

        const options = {
          key:      rzpData.keyId,
          amount:   rzpData.amount * 100, // Razorpay expects paise
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
              set({ placingOrder: false })
              resolve(orderId)
            } catch (err: any) {
              toast.error(err?.response?.data?.message || "Payment verification failed")
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
      toast.error(err?.response?.data?.message || "Something went wrong. Please try again.")
      set({ placingOrder: false })
      return null
    }
  },
}))
