"use client"

import ReviewForm from "./ReviewForm"
import ReviewList from "./ReviewList"
import ReviewSummary from "./ReviewSummary"

export default function ProductReviewSection({
  productId,
}: {
  productId: string
}) {
  return (
    <div className="space-y-8 mt-10">
      <h2 className="text-xl font-semibold">Customer Reviews</h2>

      <ReviewSummary />

      <ReviewForm productId={productId} />

      <ReviewList productId={productId} />
    </div>
  )
}