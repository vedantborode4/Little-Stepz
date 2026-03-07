import { api } from "../api-client"
import type { AdminBanner } from "./admin-banner.service"

export const BannerService = {
  /** GET /banners?position=&isActive=true — public banners for storefront */
  getByPosition: async (position: string): Promise<AdminBanner[]> => {
    try {
      const res = await api.get("/banners", { params: { position, isActive: true } })
      const d = res.data.data
      return Array.isArray(d) ? d : d?.banners ?? []
    } catch {
      return []
    }
  },
}
