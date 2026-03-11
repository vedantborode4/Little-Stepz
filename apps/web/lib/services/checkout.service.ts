import { api } from "../api-client"

const AFFILIATE_KEY = "affiliate_id"

function getAffiliateHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const affiliateId = localStorage.getItem(AFFILIATE_KEY)
  return affiliateId ? { "X-Affiliate-Id": affiliateId } : {}
}

export const CheckoutService = {
  placeOrder: async (addressId: string, paymentMethod: string) => {
    const res = await api.post("/checkout", { addressId, paymentMethod }, {
      headers: getAffiliateHeaders(),
    })
    return res.data.data
  },

  verifyPayment: async (payload: any) => {
    const res = await api.post("/checkout/verify", payload)
    return res.data.data
  },
}
