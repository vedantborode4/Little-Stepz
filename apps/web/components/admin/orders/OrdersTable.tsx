"use client"

import { useState } from "react"
import OrderStatusBadge from "./OrderStatusBadge"
import OrderRowActions from "./OrderRowActions"
import OrderDetailsDrawer from "./OrderDetailsDrawer"
import type { AdminOrder } from "../../../lib/services/admin-order.service"

interface Props {
  data: AdminOrder[]
  refresh: () => void
}

export default function OrdersTable({ data, refresh }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)

  if (!data?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-500">
        No orders found
      </div>
    )
  }
  

  return (
    <>
      <div className="bg-white border border-gray-300 rounded-xl overflow-hidden">

        <table className="w-full text-sm">

          {/* ---------------- HEADER ---------------- */}
          <thead className="text-gray-500 bg-gray-50">
            <tr className="text-left">
              <th className="p-4 font-medium">Order ID</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Total</th>
              <th className="p-4 font-medium">Payment</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 w-[220px]"></th>
            </tr>
          </thead>

          {/* ---------------- BODY ---------------- */}
          <tbody>
            {data.map((order) => (
              <tr
                key={order.id}
                className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                onClick={() => setSelectedOrder(order)}
              >
                <td className="p-4 font-medium">
                  #{order.id.slice(-6)}
                </td>

                <td className="p-4">
                  {order.user?.name || "—"}
                </td>

                <td className="p-4 font-semibold">
                  ₹{order.total}
                </td>

                <td className="p-4 text-xs">
                  {order.payment?.status || "—"}
                </td>

                <td className="p-4">
                  <OrderStatusBadge status={order.status} />
                </td>

                <td className="p-4 text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>

                {/* ACTIONS — stop row click */}
                <td
                  className="p-4 "
                  onClick={(e) => e.stopPropagation()}
                >
                  <OrderRowActions order={order} refresh={refresh} />
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {/* ---------------- DRAWER ---------------- */}
      {selectedOrder && (
        <OrderDetailsDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  )
}