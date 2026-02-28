"use client"

import { X } from "lucide-react"

const ALL_STATUSES = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
  "RETURN_REQUESTED", "RETURNED", "REFUNDED",
]

interface Props {
  filters: Record<string, any>
  setFilters: (filters: Record<string, any>) => void
}

export default function OrdersFilters({ filters, setFilters }: Props) {
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex items-center gap-2">
      <select
        value={filters.status || ""}
        onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        className="border border-gray-200 text-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
      >
        <option value="">All Statuses</option>
        {ALL_STATUSES.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>

      <input
        type="date"
        value={filters.from || ""}
        onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
        className="border border-gray-200 text-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <input
        type="date"
        value={filters.to || ""}
        onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
        className="border border-gray-200 text-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      {hasFilters && (
        <button
          onClick={() => setFilters({})}
          className="flex items-center gap-1 text-xs text-red-500 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  )
}
