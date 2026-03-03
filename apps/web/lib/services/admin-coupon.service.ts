import { api } from "../api-client"

export interface AdminCoupon {
  id: string
  code: string
  type: "PERCENTAGE" | "FLAT"
  value: number
  minOrderValue?: number | null
  maxDiscount?: number | null
  usageLimit?: number | null
  usedCount: number
  validFrom?: string | null
  validUntil?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCouponBody {
  code: string
  type: "PERCENTAGE" | "FLAT"
  value: number
  minOrderValue?: number
  maxDiscount?: number
  usageLimit?: number
  validFrom?: string
  validUntil?: string
  isActive?: boolean
}

export const AdminCouponService = {
  /** GET /admin/coupons?page=&limit=&activeOnly=&sort= */
  getAll: async (params?: { page?: number; limit?: number; activeOnly?: boolean; sort?: string }) => {
    const res = await api.get("/admin/coupons", { params })
    const d = res.data.data
    return {
      coupons: d.coupons as AdminCoupon[],
      total: d.total as number,
      pages: d.pages as number,
    }
  },

  /** POST /admin/coupons */
  create: async (body: CreateCouponBody): Promise<AdminCoupon> => {
    const res = await api.post("/admin/coupons", body)
    return res.data.data
  },

  /** PUT /admin/coupons/:id */
  update: async (id: string, body: Partial<CreateCouponBody> & { updatedAt?: string }): Promise<AdminCoupon> => {
    const res = await api.put(`/admin/coupons/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/coupons/:id */
  delete: async (id: string) => {
    await api.delete(`/admin/coupons/${id}`)
  },
}
