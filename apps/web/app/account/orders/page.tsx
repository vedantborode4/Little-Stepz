"use client"

import { useEffect } from "react"
import { useOrderStore } from "../../../store/useOrderStore"
import Link from "next/link"

export default function OrdersPage() {
  const { orders, fetchOrders, loading } = useOrderStore()

  useEffect(() => {
    fetchOrders()
  }, [])

  if (loading) return <div>Loading orders…</div>

  if (!orders.length)
    return <div className="text-center py-20">No orders yet</div>

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/account/orders/${order.id}`}
          className="block border rounded-xl p-4 hover:shadow-sm"
        >
          <div className="flex justify-between">
            <span className="font-medium">Order #{order.id}</span>
            <span className="text-primary">₹{order.total}</span>
          </div>

          <div className="text-sm text-muted">
            {order.items.length} items • {order.status}
          </div>
        </Link>
      ))}
    </div>
  )
}
