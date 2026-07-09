import StarRating from "./StarRating"
import { Review } from "../../types/review"
import { User } from "lucide-react"

export default function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User size={14} className="text-primary" />
          </div>
          <p className="font-semibold text-sm text-text">{review.user.name}</p>
        </div>
        <p className="text-xs text-faint">
          {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <StarRating value={review.rating} size={13} />

      {review.comment && (
        <p className="text-sm text-muted leading-relaxed">{review.comment}</p>
      )}
    </div>
  )
}
