"use client"

import { useState } from "react"
import { useReviewStore } from "../../store/useReviewStore"
import { Star, Loader2, MessageSquare } from "lucide-react"

export default function ReviewForm({ productId }: { productId: string }) {
  const addReview = useReviewStore((s) => s.addReview)
  const creating = useReviewStore((s) => s.creating)

  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select a rating")
      return
    }
    setError("")
    await addReview(productId, rating, comment)
    setRating(0)
    setComment("")
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
          <MessageSquare size={13} className="text-primary" />
        </div>
        <h3 className="font-semibold text-gray-900">Write a Review</h3>
      </div>

      {/* Star picker */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Your Rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={24}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)}
              className={`cursor-pointer transition-all ${
                (hovered || rating) >= i
                  ? "fill-yellow-400 text-yellow-400 scale-110"
                  : "text-gray-200 hover:text-yellow-300"
              }`}
            />
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-gray-500 self-center">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </span>
          )}
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      </div>

      {/* Comment */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Your Review (optional)</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
          placeholder="Share your thoughts about this product..."
          rows={3}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={creating}
        className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
      >
        {creating && <Loader2 size={14} className="animate-spin" />}
        {creating ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  )
}
