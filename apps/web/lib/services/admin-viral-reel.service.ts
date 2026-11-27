import { api } from "../api-client"
import type { ViralReelInput } from "@repo/zod-schema/index"

export interface AdminReelProduct {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  /** False when the product's category is switched off — the store skips it. */
  visible?: boolean
}

export interface AdminViralReel {
  id: string
  reelUrl: string
  coverImageUrl: string
  caption: string | null
  sortOrder: number
  isActive: boolean
  products: AdminReelProduct[]
  createdAt: string
  updatedAt: string
}

export const AdminViralReelService = {
  getAll: async (): Promise<AdminViralReel[]> => {
    const res = await api.get("/admin/viral-reels")
    return res.data.data.reels
  },

  create: async (body: ViralReelInput): Promise<AdminViralReel> => {
    const res = await api.post("/admin/viral-reels", body)
    return res.data.data
  },

  update: async (id: string, body: ViralReelInput): Promise<AdminViralReel> => {
    const res = await api.put(`/admin/viral-reels/${id}`, body)
    return res.data.data
  },

  toggle: async (id: string) => {
    const res = await api.patch(`/admin/viral-reels/${id}/toggle`)
    return res.data.data as { id: string; isActive: boolean }
  },

  delete: async (id: string) => {
    await api.delete(`/admin/viral-reels/${id}`)
  },
}
