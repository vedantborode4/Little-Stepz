"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { DollarSign } from "lucide-react"

const statusColors: Record<string, string> = {
  PENDING:   "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  APPROVED:  "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  PAID:      "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  CANCELLED: "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400",
}

export default function CommissionHistory() {
  const { commissions, fetchCommissions } = useAffiliateStore()

  useEffect(() => {
    fetchCommissions({ page: 1, limit: 50 })
  }, [])

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-text">Commissions</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">Your earned commissions per order</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {!commissions?.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <DollarSign size={22} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-muted">No commissions yet</p>
            <p className="text-xs text-faint mt-1">Commissions are added once referred orders are confirmed</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-muted text-left">
                    <th className="p-4 font-medium">Order</th>
                    <th className="p-4 font-medium">Order Total</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-surface-2/50 transition">
                      <td className="p-4 font-mono text-xs font-semibold text-muted">
                        #{c.orderId?.slice(-8).toUpperCase()}
                      </td>
                      <td className="p-4 text-muted">
                        ₹{c.order?.total?.toLocaleString("en-IN") ?? "—"}
                      </td>
                      <td className="p-4 font-semibold text-green-600 dark:text-green-400">
                        ₹{c.amount?.toLocaleString("en-IN") ?? "—"}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-surface-2 text-muted"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-faint text-xs text-right">
                        {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {commissions.map((c: any) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-muted">
                      #{c.orderId?.slice(-8).toUpperCase()}
                    </span>
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-surface-2 text-muted"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Order: ₹{c.order?.total?.toLocaleString("en-IN") ?? "—"}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">+₹{c.amount?.toLocaleString("en-IN") ?? "—"}</span>
                  </div>
                  <p className="text-xs text-faint">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
