"use client"

import { useEffect } from "react"
import { useReviewStore } from "../../store/useReviewStore"
import ReviewItem from "./ReviewItem"
import { Loader2, ChevronDown } from "lucide-react"

export default function ReviewList({ productId }: { productId: string }) {
  const { reviews, loadMore, page, totalPages, loading } = useReviewStore()

  useEffect(() => {
    useReviewStore.getState().fetchReviews(productId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Loading reviews...</span>
      </div>
    )
  }

  if (!reviews.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No reviews yet. Be the first to review this product!
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}

      {page < totalPages && (
        <button
          onClick={() => loadMore(productId)}
          className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
        >
          <ChevronDown size={15} />
          Load More Reviews
        </button>
      )}
    </div>
  )
}
