import { create } from "zustand"
import { CheckoutService } from "../lib/services/checkout.service"
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

  placeOrder: async (addressId) => {
    try {
      set({ placingOrder: true })

      const method = get().paymentMethod

      const res = await CheckoutService.placeOrder(addressId, method)

      /* ---------------- COD ---------------- */

      if (method === "COD") {
        toast.success("Order placed successfully 🎉")
        return res.orderId
      }

      /* ---------------- RAZORPAY ---------------- */

      const options = {
        key: res.key,
        amount: res.amount,
        currency: "INR",
        order_id: res.razorpayOrderId,

        handler: async (response: any) => {
          await CheckoutService.verifyPayment(response)
          toast.success("Payment successful 🎉")
          window.location.href = `/order-success/${res.orderId}`
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()

      return null
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Payment failed")
      return null
    } finally {
      set({ placingOrder: false })
    }
  },
}))
