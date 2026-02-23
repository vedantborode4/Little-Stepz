import StarRating from "./StarRating"
import { Review } from "../../types/review"

export default function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="border-b py-4 space-y-1">
      <p className="font-medium text-sm">{review.user.name}</p>

      <StarRating value={review.rating} />

      <p className="text-sm text-muted">{review.comment}</p>
    </div>
  )
}
