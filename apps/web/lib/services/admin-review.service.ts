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
   * Fetches all reviews.
   * Tries GET /admin/reviews first (admin-specific endpoint).
   * If that returns 404/500, falls back to fetching all products
   * and aggregating their reviews via the public endpoint.
   */
  getAll: async (params?: { page?: number; limit?: number }): Promise<{
    reviews: AdminReview[]
    total: number
    pages: number
  }> => {
    try {
      const res = await api.get("/admin/reviews", { params })
      const d = res.data.data
      return {
        reviews: (Array.isArray(d) ? d : d?.reviews ?? []) as AdminReview[],
        total: d?.total ?? 0,
        pages: d?.pages ?? 1,
      }
    } catch (err: any) {
      const status = err?.response?.status
      // Only fall back on 404 or 500 — re-throw auth errors
      if (status === 401 || status === 403) throw err

      // Fallback: fetch reviews per product and merge
      try {
        const productsRes = await api.get("/products", { params: { limit: 50 } })
        const products = productsRes.data.data?.products ?? []

        const allReviews: AdminReview[] = []
        await Promise.allSettled(
          products.map(async (p: any) => {
            try {
              const r = await api.get(`/products/${p.id}/reviews`, { params: { limit: 20 } })
              const list: any[] = Array.isArray(r.data.data)
                ? r.data.data
                : r.data.data?.reviews ?? []
              // Attach product info since per-product endpoint may not include it
              list.forEach((rev) => {
                allReviews.push({
                  ...rev,
                  product: rev.product ?? {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    images: p.images,
                  },
                })
              })
            } catch { /* skip products with no reviews */ }
          })
        )

        // Sort newest first
        allReviews.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        const page = params?.page ?? 1
        const limit = params?.limit ?? 15
        const start = (page - 1) * limit
        const paginated = allReviews.slice(start, start + limit)

        return {
          reviews: paginated,
          total: allReviews.length,
          pages: Math.max(1, Math.ceil(allReviews.length / limit)),
        }
      } catch {
        return { reviews: [], total: 0, pages: 1 }
      }
    }
  },

  /** GET /products/:productId/reviews — per-product, used for filter mode */
  getProductReviews: async (
    productId: string,
    params?: { page?: number; limit?: number }
  ) => {
    const res = await api.get(`/products/${productId}/reviews`, { params })
    const d = res.data.data
    const list: AdminReview[] = Array.isArray(d) ? d : d?.reviews ?? []
    return {
      reviews: list,
      total: d?.total ?? list.length,
      pages: d?.pages ?? 1,
    }
  },

  /** DELETE /admin/reviews/:reviewId */
  delete: async (reviewId: string) => {
    await api.delete(`/admin/reviews/${reviewId}`)
  },
}
