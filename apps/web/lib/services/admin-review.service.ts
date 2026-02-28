import { api } from "../api-client"

export interface AdminReview {
  id: string
  rating: number
  comment: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  createdAt: string
  user: { id: string; name: string; email: string }
  product: { id: string; name: string; slug: string; images?: { url: string }[] }
}

export const AdminReviewService = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get("/reviews", { params })
    return res.data.data
  },

  approve: async (id: string) => {
    const res = await api.patch(`/reviews/${id}/approve`)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/reviews/${id}`)
  },
}
