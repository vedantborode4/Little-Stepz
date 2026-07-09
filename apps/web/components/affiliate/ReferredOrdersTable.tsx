"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { ShoppingBag } from "lucide-react"

const orderStatusColors: Record<string, string> = {
  PENDING:          "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  CONFIRMED:        "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PROCESSING:       "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  SHIPPED:          "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  OUT_FOR_DELIVERY: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  DELIVERED:        "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  CANCELLED:        "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400",
  RETURN_REQUESTED: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  RETURNED:         "bg-surface-2 text-muted",
  REFUNDED:         "bg-surface-2 text-muted",
}

const paymentColors: Record<string, string> = {
  PAID:    "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  SUCCESS: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  PENDING: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  FAILED:  "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400",
}

export default function ReferredOrdersTable() {
  const { orders, fetchOrders } = useAffiliateStore()

  useEffect(() => {
    fetchOrders({ page: 1, limit: 50 })
  }, [])

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-text">Referred Orders</h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">All orders placed by users you referred</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {!orders?.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={22} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-muted">No referred orders yet</p>
            <p className="text-xs text-faint mt-1">Orders from your referrals will appear here</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-muted text-left">
                    <th className="p-4 font-medium">Order ID</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Payment</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Commission</th>
                    <th className="p-4 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.id} className="border-t border-border hover:bg-surface-2/50 transition">
                      <td className="p-4 font-mono text-xs font-semibold text-muted">
                        #{o.id?.slice(-8).toUpperCase()}
                      </td>
                      <td className="p-4 font-semibold text-text">
                        ₹{o.total?.toLocaleString("en-IN")}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${paymentColors[o.payment?.status] ?? "bg-surface-2 text-faint"}`}>
                          {o.payment?.status || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStatusColors[o.status] ?? "bg-surface-2 text-muted"}`}>
                          {o.status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-4">
                        {o.commissions?.length ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            ₹{o.commissions.reduce((s: number, c: any) => s + (c.amount ?? 0), 0).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="p-4 text-faint text-xs text-right">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {orders.map((o: any) => (
                <div key={o.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-muted">
                      #{o.id?.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-text">
                      ₹{o.total?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${paymentColors[o.payment?.status] ?? "bg-surface-2 text-faint"}`}>
                      {o.payment?.status || "—"}
                    </span>
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${orderStatusColors[o.status] ?? "bg-surface-2 text-muted"}`}>
                      {o.status?.replace(/_/g, " ")}
                    </span>
                    {o.commissions?.length ? (
                      <span className="text-[11px] px-2 py-1 rounded-full font-medium bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400">
                        +₹{o.commissions.reduce((s: number, c: any) => s + (c.amount ?? 0), 0).toLocaleString("en-IN")} commission
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-faint">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
