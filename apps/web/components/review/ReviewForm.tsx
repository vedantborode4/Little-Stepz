"use client"

import { useState } from "react"
import { useReviewStore } from "../../store/useReviewStore"
import { Star } from "lucide-react"

export default function ReviewForm({ productId }: { productId: string }) {
  const addReview = useReviewStore((s) => s.addReview)
  const creating = useReviewStore((s) => s.creating)

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select rating")
      return
    }

    setError("")
    await addReview(productId, rating, comment)

    setRating(0)
    setComment("")
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Write a review</h3>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            onClick={() => setRating(i)}
            className={`cursor-pointer ${
              rating >= i ? "fill-primary text-primary" : ""
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full border rounded-lg p-2 text-sm"
        placeholder="Share your thoughts"
      />

      <button
        onClick={handleSubmit}
        disabled={creating}
        className="bg-primary text-white px-4 py-2 rounded-lg text-sm"
      >
        {creating ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  )
}