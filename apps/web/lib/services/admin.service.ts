import { api } from "../api-client"

export const AdminService = {
  getStats: async (query?: { from?: string; to?: string }) => {
    const res = await api.get("/admin/stats", { params: query })
    return res.data.data
  },
}