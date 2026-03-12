import { Star } from "lucide-react"

export default function StarRating({
  value,
  onChange,
  size = 16,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          onClick={() => onChange?.(s)}
          className={`transition-colors ${onChange ? "cursor-pointer hover:text-yellow-400" : ""} ${
            s <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
          }`}
        />
      ))}
    </div>
  )
}
