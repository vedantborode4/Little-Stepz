"use client"

import ReviewForm from "./ReviewForm"
import ReviewList from "./ReviewList"
import ReviewSummary from "./ReviewSummary"
import { Star } from "lucide-react"

export default function ProductReviewSection({ productId }: { productId: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-yellow-50 dark:bg-yellow-500/15 rounded-lg flex items-center justify-center">
          <Star size={14} className="text-yellow-500 dark:text-yellow-400 fill-yellow-400" />
        </div>
        <h2 className="font-anton text-xl uppercase tracking-wide text-text">Customer Reviews</h2>
      </div>

      <ReviewSummary />
      <ReviewForm productId={productId} />
      <ReviewList productId={productId} />
    </div>
  )
}
