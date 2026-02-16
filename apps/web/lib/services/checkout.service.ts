import { api } from "../api-client"

export const CheckoutService = {
  placeOrder: async (addressId: string, paymentMethod: string) => {
    const res = await api.post("/checkout", { addressId, paymentMethod })
    return res.data.data
  },

  verifyPayment: async (payload: any) => {
    const res = await api.post("/checkout/verify", payload)
    return res.data.data
  },
}
