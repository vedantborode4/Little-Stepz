import { create } from "zustand"
import { AffiliateService } from "../lib/services/affiliate.service"

/* ---------------- TYPES ---------------- */

interface Pagination {
  total: number
  page: number
  limit: number
  pages: number
}

interface ShareLinks {
  whatsapp: string
  telegram: string
  twitter: string
  copy: string
}

interface State {
  /* core */
  profile: any | null
  stats: any | null
  referralLink: string | null
  shareLinks: ShareLinks | null
  loading: boolean

  /* tables */
  clicks: any[]
  conversions: any[]
  commissions: any[]
  orders: any[]

  pagination: Pagination | null

  /* core fetch */
  fetchAffiliate: () => Promise<void>

  /* table fetch */
  fetchClicks: (query?: Record<string, any>) => Promise<void>
  fetchConversions: (query?: Record<string, any>) => Promise<void>
  fetchCommissions: (query?: Record<string, any>) => Promise<void>
  fetchOrders: (query?: Record<string, any>) => Promise<void>
}

/* ---------------- STORE ---------------- */

export const useAffiliateStore = create<State>((set) => ({
  profile: null,
  stats: null,
  referralLink: null,
  shareLinks: null,
  loading: false,

  clicks: [],
  conversions: [],
  commissions: [],
  orders: [],
  pagination: null,

  /* ---------------- CORE ---------------- */

  fetchAffiliate: async () => {
    try {
      set({ loading: true })

      const [profile, stats, link] = await Promise.all([
        AffiliateService.getMe(),
        AffiliateService.getStats(),
        AffiliateService.getReferralLink(),
      ])

      set({
        profile,
        stats,

        // ✅ correct mapping from backend
        referralLink: link?.referralLink ?? null,
        shareLinks: link?.shareLinks ?? null,

        loading: false,
      })
    } catch (err) {
      console.error("Affiliate fetch failed", err)
      set({ loading: false })
    }
  },

  /* ---------------- CLICKS ---------------- */

  fetchClicks: async (query) => {
    try {
      const res = await AffiliateService.getClicks(query)

      set({
        clicks: res?.data ?? [],
        pagination: res?.pagination ?? null,
      })
    } catch (err) {
      console.error("Clicks fetch failed", err)
      set({ clicks: [] })
    }
  },

  /* ---------------- CONVERSIONS ---------------- */

  fetchConversions: async (query) => {
    try {
      const res = await AffiliateService.getConversions(query)

      set({
        conversions: res?.data ?? [],
        pagination: res?.pagination ?? null,
      })
    } catch (err) {
      console.error("Conversions fetch failed", err)
      set({ conversions: [] })
    }
  },

  /* ---------------- COMMISSIONS ---------------- */

  fetchCommissions: async (query) => {
    try {
      const res = await AffiliateService.getCommissions(query)

      set({
        commissions: res?.data ?? [],
        pagination: res?.pagination ?? null,
      })
    } catch (err) {
      console.error("Commissions fetch failed", err)
      set({ commissions: [] })
    }
  },

  /* ---------------- ORDERS ---------------- */

  fetchOrders: async (query) => {
    try {
      const res = await AffiliateService.getOrders(query)

      set({
        orders: res?.orders ?? [],
        pagination: res?.pagination ?? null,
      })
    } catch (err) {
      console.error("Orders fetch failed", err)
      set({ orders: [] })
    }
  },
}))