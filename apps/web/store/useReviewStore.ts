import { create } from "zustand"
import { Review } from "../types/review"
import { ReviewService } from "../lib/services/review.service"
import { toast } from "sonner"

/* ---------------- TYPES ---------------- */

interface ReviewStats {
  average: number
  total: number
  breakdown: { star: number; count: number }[]
}

interface ReviewState {
  reviews: Review[]
  stats: ReviewStats | null

  page: number
  totalPages: number

  loading: boolean
  creating: boolean

  fetchReviews: (productId: string) => Promise<void>
  loadMore: (productId: string) => Promise<void>

  addReview: (
    productId: string,
    rating: number,
    comment: string
  ) => Promise<void>
}

/* ---------------- HELPERS ---------------- */

const calculateStats = (reviews: Review[]): ReviewStats | null => {
  if (!reviews.length) return null

  const total = reviews.length

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  return {
    average: Number((sum / total).toFixed(1)),
    total,
    breakdown,
  }
}

/* ---------------- STORE ---------------- */

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: [],
  stats: null,

  page: 1,
  totalPages: 1,

  loading: false,
  creating: false,

  /* ---------------- FETCH REVIEWS ---------------- */

  fetchReviews: async (productId) => {
    set({ loading: true, page: 1 })

    try {
      const res = await ReviewService.getByProduct(productId, 1)

      set({
        reviews: res.reviews,
        totalPages: res.pages,
        page: 1,
        stats: calculateStats(res.reviews),
      })
    } catch {
      toast.error("Failed to load reviews")
    } finally {
      set({ loading: false })
    }
  },

  /* ---------------- LOAD MORE ---------------- */

  loadMore: async (productId) => {
    const { page, totalPages, reviews } = get()

    if (page >= totalPages) return

    const nextPage = page + 1

    try {
      const res = await ReviewService.getByProduct(productId, nextPage)

      const updatedReviews = [...reviews, ...res.reviews]

      set({
        reviews: updatedReviews,
        page: nextPage,
        stats: calculateStats(updatedReviews),
      })
    } catch {
      toast.error("Failed to load more reviews")
    }
  },

  /* ---------------- ADD REVIEW ---------------- */

  addReview: async (productId, rating, comment) => {
    if (!rating) {
      toast.error("Please select a rating")
      return
    }

    try {
      set({ creating: true })

      const review = await ReviewService.create({
        productId,
        rating,
        comment,
      })

      set((state) => {
        const updated = [review, ...state.reviews]

        return {
          reviews: updated,
          stats: calculateStats(updated),
        }
      })

      toast.success("Review added 🎉")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to add review")
    } finally {
      set({ creating: false })
    }
  },
}))
