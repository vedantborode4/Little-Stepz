"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { ShoppingBag } from "lucide-react"

const orderStatusColors: Record<string, string> = {
  PENDING:          "bg-yellow-50 text-yellow-600",
  CONFIRMED:        "bg-blue-50 text-blue-600",
  PROCESSING:       "bg-blue-50 text-blue-600",
  SHIPPED:          "bg-indigo-50 text-indigo-600",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-600",
  DELIVERED:        "bg-green-50 text-green-600",
  CANCELLED:        "bg-red-50 text-red-500",
  RETURN_REQUESTED: "bg-orange-50 text-orange-600",
  RETURNED:         "bg-gray-100 text-gray-500",
  REFUNDED:         "bg-gray-100 text-gray-500",
}

const paymentColors: Record<string, string> = {
  PAID:    "bg-green-50 text-green-600",
  SUCCESS: "bg-green-50 text-green-600",
  PENDING: "bg-yellow-50 text-yellow-600",
  FAILED:  "bg-red-50 text-red-500",
}

export default function ReferredOrdersTable() {
  const { orders, fetchOrders } = useAffiliateStore()

  useEffect(() => {
    fetchOrders({ page: 1, limit: 50 })
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Referred Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">All orders placed by users you referred</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {!orders?.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={22} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-gray-700">No referred orders yet</p>
            <p className="text-xs text-gray-400 mt-1">Orders from your referrals will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
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
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4 font-mono text-xs font-semibold text-gray-700">
                    #{o.id?.slice(-8).toUpperCase()}
                  </td>
                  <td className="p-4 font-semibold text-gray-900">
                    ₹{o.total?.toLocaleString("en-IN")}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${paymentColors[o.payment?.status] ?? "bg-gray-100 text-gray-400"}`}>
                      {o.payment?.status || "—"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStatusColors[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {o.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-4">
                    {o.commissions?.length ? (
                      <span className="text-green-600 font-semibold">
                        ₹{o.commissions.reduce((s: number, c: any) => s + (c.amount ?? 0), 0).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-xs text-right">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
