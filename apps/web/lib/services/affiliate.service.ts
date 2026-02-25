import { api } from "../api-client"

type Query = Record<string, any>

export const AffiliateService = {
  apply: async (payload: any) => {
    const res = await api.post("/affiliate/apply", payload)
    return res.data.data
  },

  getMe: async () => {
    const res = await api.get("/affiliate/me")
    return res.data.data
  },

  getReferralLink: async () => {
    const res = await api.get("/affiliate/referral-link")
    return res.data.data
  },

  getStats: async () => {
    const res = await api.get("/affiliate/stats")
    return res.data.data
  },

  getClicks: async (query?: Query) => {
    const res = await api.get("/affiliate/clicks", { params: query })
    return res.data.data
  },

  getConversions: async (query?: Query) => {
    const res = await api.get("/affiliate/conversions", { params: query })
    return res.data.data
  },

  getCommissions: async (query?: Query) => {
    const res = await api.get("/affiliate/commissions", { params: query })
    return res.data.data
  },

  getOrders: async (query?: Query) => {
    const res = await api.get("/affiliate/orders", { params: query })
    return res.data.data
  },

  updatePayout: async (payload: any) => {
    const res = await api.put("/affiliate/payout-details", payload)
    return res.data.data
  },

  withdraw: async (amount: number) => {
    const res = await api.post("/affiliate/withdraw", { amount })
    return res.data.data
  },
}