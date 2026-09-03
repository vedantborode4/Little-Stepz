"use client"

import { X } from "lucide-react"

const ALL_STATUS = [
  "PENDING","CONFIRMED","PROCESSING","SHIPPED",
  "OUT_FOR_DELIVERY","DELIVERED","CANCELLED",
  "RETURN_REQUESTED","RETURNED","REFUNDED",
]

interface Props {
  filters: Record<string, any>
  setFilters: (filters: Record<string, any>) => void
}

export default function OrdersFilters({ filters, setFilters }: Props) {
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <select
        value={filters.status || ""}
        onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        className="border border-border text-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
      >
        <option value="">All Status</option>
        {ALL_STATUS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>

      {/* Payment plan / outstanding money. "Balance due" is the operational queue —
          orders where a deposit landed and the rest has not been collected yet. */}
      <select
        value={filters.balanceState ? `balance:${filters.balanceState}` : filters.paymentPlan ? `plan:${filters.paymentPlan}` : ""}
        onChange={(e) => {
          const v = e.target.value
          const next: Record<string, unknown> = { ...filters, paymentPlan: undefined, balanceState: undefined }
          if (v.startsWith("plan:")) next.paymentPlan = v.slice(5)
          else if (v.startsWith("balance:")) next.balanceState = v.slice(8)
          setFilters(next)
        }}
        className="border border-border text-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
      >
        <option value="">All plans</option>
        <option value="plan:FULL">Paid in full</option>
        <option value="balance:due">Partial — balance due</option>
        <option value="balance:settled">Partial — settled</option>
      </select>

      <div className="flex gap-2">
        <input type="date" value={filters.from || ""}
          onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
          className="flex-1 sm:flex-none border border-border text-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input type="date" value={filters.to || ""}
          onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
          className="flex-1 sm:flex-none border border-border text-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {hasFilters && (
          <button onClick={() => setFilters({})}
            className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/15 transition shrink-0">
            <X size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
