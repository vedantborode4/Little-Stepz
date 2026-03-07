import { api } from "../api-client"

export type BannerPosition =
  | "HOME_HERO" | "HOME_MID" | "CATEGORY_TOP" | "PRODUCT_SIDEBAR" | "CHECKOUT_TOP"

export interface AdminBanner {
  id: string
  title: string
  subtitle?: string | null
  imageUrl: string
  linkUrl?: string | null
  altText?: string | null
  position: BannerPosition
  sortOrder: number
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  targetRole?: string | null
  clickCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateBannerBody {
  title: string
  subtitle?: string
  imageUrl: string
  linkUrl?: string
  altText?: string
  position: BannerPosition
  sortOrder?: number
  isActive?: boolean
  startsAt?: string
  endsAt?: string
  targetRole?: string
}

export const AdminBannerService = {
  /** GET /admin/banners?page=&limit=&position=&isActive= */
  getAll: async (params?: { page?: number; limit?: number; position?: string; isActive?: boolean }) => {
    const res = await api.get("/admin/banners", { params })
    const d = res.data.data
    // Response: { banners, pagination }
    return {
      banners: d.banners as AdminBanner[],
      pagination: d.pagination,
    }
  },

  /** GET /admin/banners/:id */
  getById: async (id: string): Promise<AdminBanner> => {
    const res = await api.get(`/admin/banners/${id}`)
    return res.data.data
  },

  /** POST /admin/banners */
  create: async (body: CreateBannerBody): Promise<AdminBanner> => {
    const res = await api.post("/admin/banners", body)
    return res.data.data
  },

  /** PUT /admin/banners/:id */
  update: async (id: string, body: Partial<CreateBannerBody>): Promise<AdminBanner> => {
    const res = await api.put(`/admin/banners/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/banners/:id */
  delete: async (id: string) => {
    await api.delete(`/admin/banners/${id}`)
  },

  /** PATCH /admin/banners/:id/toggle */
  toggle: async (id: string) => {
    const res = await api.patch(`/admin/banners/${id}/toggle`)
    return res.data.data as { bannerId: string; isActive: boolean }
  },
}
