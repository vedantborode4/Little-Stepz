"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock } from "lucide-react"
import { PreOrderService, type PreOrderSummary, type PreOrderStatus } from "../../../lib/services/preorder.service"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

const STATUS_STYLES: Record<PreOrderStatus, string> = {
  PENDING_BOOKING: "bg-gray-100 text-gray-500",
  BOOKED: "bg-blue-50 text-blue-600",
  AWAITING_BALANCE: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-green-50 text-green-600",
  EXPIRED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-50 text-red-500",
  REFUNDED: "bg-purple-50 text-purple-600",
}

const LABEL: Record<PreOrderStatus, string> = {
  PENDING_BOOKING: "Pending",
  BOOKED: "Awaiting restock",
  AWAITING_BALANCE: "Balance due",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
}

export default function MyPreOrdersPage() {
  const [items, setItems] = useState<PreOrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    PreOrderService.getMine()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-gray-900">My Pre-Orders</h1>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center">You have no pre-orders yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((po) => (
            <div key={po.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              <img
                src={po.product.images?.[0]?.url || "/placeholder.png"}
                alt={po.product.name}
                className="w-16 h-16 object-contain rounded-xl border border-gray-100"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{po.product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {po.variant?.name ? `${po.variant.name} · ` : ""}Qty {po.quantity} · Booking {inr(po.bookingAmount)}
                </p>
                <span className={`inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[po.status]}`}>
                  {LABEL[po.status]}
                </span>
              </div>
              <div className="text-right">
                {po.status === "AWAITING_BALANCE" && po.balanceToken && (
                  <Link
                    href={`/pre-orders/pay/${po.balanceToken}`}
                    className="inline-block bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    Pay {inr(po.balanceAmount)}
                  </Link>
                )}
                {po.status === "COMPLETED" && po.orderId && (
                  <Link href={`/account/orders/${po.orderId}`} className="text-xs text-primary font-medium">View order</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
