import { Star } from "lucide-react"

export default function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange?: (v: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          onClick={() => onChange?.(s)}
          className={`w-5 h-5 cursor-pointer ${
            s <= value ? "fill-yellow-400 text-yellow-400" : ""
          }`}
        />
      ))}
    </div>
  )
}