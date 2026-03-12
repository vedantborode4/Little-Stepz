"use client"

import { useReviewStore } from "../../store/useReviewStore"
import { Star } from "lucide-react"

export default function ReviewSummary() {
  const stats = useReviewStore((s) => s.stats)

  if (!stats) return null

  return (
    <div className="flex gap-8 bg-gray-50 border border-gray-100 rounded-xl p-5">
      {/* LEFT — avg score */}
      <div className="flex flex-col items-center justify-center min-w-[100px] border-r border-gray-200 pr-8">
        <p className="text-5xl font-bold text-gray-900">{stats.average.toFixed(1)}</p>
        <div className="flex gap-0.5 mt-1.5">
          {[1,2,3,4,5].map(s => (
            <Star key={s} size={12} className={s <= Math.round(stats.average) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{stats.total} review{stats.total !== 1 ? "s" : ""}</p>
      </div>

      {/* RIGHT — breakdown */}
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const entry = stats.breakdown.find((b) => b.star === star)
          const count = entry?.count ?? 0
          const percent = stats.total > 0 ? (count / stats.total) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2.5 text-sm">
              <span className="w-4 text-xs text-gray-500 text-right font-medium">{star}</span>
              <Star size={11} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
              <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${percent}%` }}
                  className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
                />
              </div>
              <span className="w-6 text-xs text-gray-400 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
