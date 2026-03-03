import { api } from "../api-client"

export interface AdminReview {
  id: string
  rating: number
  comment?: string
  createdAt: string
  user: { id: string; name: string; email: string }
  product: { id: string; name: string; slug: string; images?: { url: string }[] }
}

export const AdminReviewService = {
  /**
   * GET /products/:productId/reviews
   * Note: Admin uses the public product reviews endpoint as there is no
   * dedicated admin list-all-reviews route. Reviews are fetched per product.
   * For the admin moderation page we fetch recent reviews via product endpoint.
   */
  getProductReviews: async (productId: string, params?: { page?: number; limit?: number }) => {
    const res = await api.get(`/products/${productId}/reviews`, { params })
    return res.data.data
  },

  /** DELETE /admin/reviews/:reviewId */
  delete: async (reviewId: string) => {
    await api.delete(`/admin/reviews/${reviewId}`)
  },
}
