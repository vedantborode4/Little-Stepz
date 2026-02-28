import { api } from "../api-client"

export interface Banner {
  id: string
  title: string
  subtitle?: string
  imageUrl: string
  link?: string
  position: number
  isActive: boolean
  createdAt: string
}

export const AdminBannerService = {
  getAll: async (): Promise<Banner[]> => {
    const res = await api.get("/banners")
    return res.data.data
  },

  create: async (payload: Omit<Banner, "id" | "createdAt">): Promise<Banner> => {
    const res = await api.post("/banners", payload)
    return res.data.data
  },

  update: async (id: string, payload: Partial<Banner>): Promise<Banner> => {
    const res = await api.put(`/banners/${id}`, payload)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/banners/${id}`)
  },
}
