"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import OrderStatusBadge from "./OrderStatusBadge"
import OrderRowActions from "./OrderRowActions"
import OrderDetailsDrawer from "./OrderDetailsDrawer"
import type { AdminOrder } from "../../../lib/services/admin-order.service"

interface Props { data: AdminOrder[]; refresh: () => void }

export default function OrdersTable({ data, refresh }: Props) {
  const router = useRouter()
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)

  if (!data?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400 text-sm">
        No orders found
      </div>
    )
  }

  const paymentColor = (status: string | undefined) => {
    if (status === "PAID" || status === "SUCCESS") return "bg-green-50 text-green-600"
    if (status === "FAILED") return "bg-red-50 text-red-500"
    return "bg-yellow-50 text-yellow-600"
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Order ID</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer transition" onClick={() => setSelectedOrder(order)}>
                  <td className="p-4 font-mono text-xs font-semibold text-gray-700">#{order.id.slice(-8).toUpperCase()}</td>
                  <td className="p-4 font-medium text-gray-900">{order.user?.name || "—"}</td>
                  <td className="p-4 font-semibold text-gray-900">₹{order.total?.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${paymentColor(order.payment?.status)}`}>
                      {order.payment?.status || "—"}
                    </span>
                  </td>
                  <td className="p-4"><OrderStatusBadge status={order.status} /></td>
                  <td className="p-4 text-gray-400 text-xs">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" title="View detail">
                        <Eye size={14} />
                      </button>
                      <OrderRowActions order={order} refresh={refresh} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {data.map((order) => (
          <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3"
            onClick={() => setSelectedOrder(order)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-gray-700">#{order.id.slice(-8).toUpperCase()}</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{order.user?.name || "—"}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">₹{order.total?.toLocaleString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColor(order.payment?.status)}`}>
                {order.payment?.status || "—"}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => router.push(`/admin/orders/${order.id}`)}
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                <Eye size={13} /> View Detail
              </button>
              <div className="ml-auto"><OrderRowActions order={order} refresh={refresh} /></div>
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <OrderDetailsDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </>
  )
}