import { api } from "../api-client"

export const CheckoutService = {
  placeOrder: async (addressId: string) => {
    const res = await api.post("/checkout", { addressId })
    return res.data.data
  },
}
