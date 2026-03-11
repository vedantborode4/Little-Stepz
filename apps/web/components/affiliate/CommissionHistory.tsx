"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { DollarSign } from "lucide-react"

const statusColors: Record<string, string> = {
  PENDING:   "bg-yellow-50 text-yellow-600",
  APPROVED:  "bg-green-50 text-green-600",
  PAID:      "bg-blue-50 text-blue-600",
  CANCELLED: "bg-red-50 text-red-500",
}

export default function CommissionHistory() {
  const { commissions, fetchCommissions } = useAffiliateStore()

  useEffect(() => {
    fetchCommissions({ page: 1, limit: 50 })
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Commissions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your earned commissions per order</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {!commissions?.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <DollarSign size={22} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No commissions yet</p>
            <p className="text-xs text-gray-400 mt-1">Commissions are added once referred orders are confirmed</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Order Total</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4 font-mono text-xs font-semibold text-gray-700">
                    #{c.orderId?.slice(-8).toUpperCase()}
                  </td>
                  <td className="p-4 text-gray-600">
                    ₹{c.order?.total?.toLocaleString("en-IN") ?? "—"}
                  </td>
                  <td className="p-4 font-semibold text-green-600">
                    ₹{c.amount?.toLocaleString("en-IN") ?? "—"}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs text-right">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
