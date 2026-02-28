"use client"

import { useEffect } from "react"
import { useReviewStore } from "../../store/useReviewStore"

export default function ReviewList({ productId }: { productId: string }) {
  const {
    reviews,
    loadMore,
    page,
    totalPages,
    loading,
  } = useReviewStore()

  useEffect(() => {
    useReviewStore.getState().fetchReviews(productId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]) // ✅ re-fetch when the product changes, not when the action ref changes

  if (loading) return <p>Loading reviews...</p>

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <p className="font-medium">{r.user.name}</p>
            <p>{r.rating}★</p>
          </div>

          <p className="text-muted text-xs">
            {new Date(r.createdAt).toDateString()}
          </p>

          <p className="mt-2">{r.comment}</p>
        </div>
      ))}

      {page < totalPages && (
        <button
          onClick={() => loadMore(productId)}
          className="border px-4 py-2 rounded-lg text-sm"
        >
          Load more
        </button>
      )}
    </div>
  )
}