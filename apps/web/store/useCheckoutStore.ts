import { create } from "zustand"
import { CheckoutService } from "../lib/services/checkout.service"
import { toast } from "sonner"

interface CheckoutState {
  placingOrder: boolean
  placeOrder: (addressId: string) => Promise<string | null>
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  placingOrder: false,

  placeOrder: async (addressId) => {
    try {
      set({ placingOrder: true })

      const res = await CheckoutService.placeOrder(addressId)

      toast.success("Order placed successfully 🎉")

      return res.orderId
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to place order"
      )
      return null
    } finally {
      set({ placingOrder: false })
    }
  },
}))
