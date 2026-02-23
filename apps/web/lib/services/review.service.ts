import { api } from "../api-client"
import { PaginatedReviews } from "../../types/review"

export const ReviewService = {
  getByProduct: async (
    productId: string,
    page = 1
  ): Promise<PaginatedReviews> => {
    const res = await api.get(
      `/products/${productId}/reviews?page=${page}`
    )

    return res.data.data   // ✅ matches your ApiResponse
  },

  create: async (data: {
    productId: string
    rating: number
    comment: string
  }) => {
    const res = await api.post("/reviews", data)
    return res.data.data
  },
}
