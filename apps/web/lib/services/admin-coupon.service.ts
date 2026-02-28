import { api } from "../api-client"

export interface Coupon {
  id: string
  code: string
  discountType: "PERCENTAGE" | "FLAT"
  discountValue: number
  minOrderAmount?: number
  maxDiscount?: number
  usageLimit?: number
  usedCount: number
  expiresAt?: string
  isActive: boolean
  createdAt: string
}

export const AdminCouponService = {
  getAll: async (): Promise<Coupon[]> => {
    const res = await api.get("/coupons")
    return res.data.data
  },

  create: async (payload: Omit<Coupon, "id" | "usedCount" | "createdAt">): Promise<Coupon> => {
    const res = await api.post("/coupons", payload)
    return res.data.data
  },

  update: async (id: string, payload: Partial<Coupon>): Promise<Coupon> => {
    const res = await api.put(`/coupons/${id}`, payload)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/coupons/${id}`)
  },
}
