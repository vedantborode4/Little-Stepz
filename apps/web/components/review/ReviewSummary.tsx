"use client"

import { useReviewStore } from "../../store/useReviewStore"

export default function ReviewSummary() {
  const stats = useReviewStore((s) => s.stats)

  if (!stats) return null

  return (
    <div className="flex gap-8">
      {/* LEFT — AVG */}
      <div className="min-w-[120px]">
        <p className="text-4xl font-bold text-primary">
          {stats.average.toFixed(1)}
        </p>
        <p className="text-sm text-muted">
          {stats.total} review{stats.total > 1 ? "s" : ""}
        </p>
      </div>

      {/* RIGHT — BREAKDOWN */}
      <div className="flex-1 space-y-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const entry = stats.breakdown.find((b) => b.star === star)

          const count = entry?.count ?? 0

          const percent =
            stats.total > 0 ? (count / stats.total) * 100 : 0

          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-6">{star}★</span>

              <div className="flex-1 bg-gray-200 h-2 rounded">
                <div
                  style={{ width: `${percent}%` }}
                  className="bg-primary h-2 rounded"
                />
              </div>

              <span className="w-6 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
