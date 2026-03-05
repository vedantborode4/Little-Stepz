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
  getAll: async (params?: { page?: number; limit?: number; position?: string; isActive?: boolean }) => {
    const res = await api.get("/admin/banners", { params })
    const d = res.data.data
    return {
      banners: d.banners as AdminBanner[],
      pagination: d.pagination,
    }
  },

  getById: async (id: string): Promise<AdminBanner> => {
    const res = await api.get(`/admin/banners/${id}`)
    return res.data.data
  },

  create: async (body: CreateBannerBody): Promise<AdminBanner> => {
    const res = await api.post("/admin/banners", body)
    return res.data.data
  },

  update: async (id: string, body: Partial<CreateBannerBody>): Promise<AdminBanner> => {
    const res = await api.put(`/admin/banners/${id}`, body)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/admin/banners/${id}`)
  },

  toggle: async (id: string) => {
    const res = await api.patch(`/admin/banners/${id}/toggle`)
    return res.data.data as { bannerId: string; isActive: boolean }
  },
}
