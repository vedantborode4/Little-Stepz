"use client"

import AuthGuard from "../../../components/guard/AuthGuard"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Clock, Package, CheckCircle, XCircle, RotateCcw, AlertCircle, ChevronRight
} from "lucide-react"
import { PreOrderService, type PreOrderSummary, type PreOrderStatus } from "../../../lib/services/preorder.service"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

const STATUS_META: Record<PreOrderStatus, { label: string; color: string; icon: any }> = {
  PENDING_BOOKING:  { label: "Pending",          color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Clock },
  BOOKED:           { label: "Awaiting Restock",  color: "bg-blue-50 text-blue-700 border-blue-200",       icon: Package },
  AWAITING_BALANCE: { label: "Balance Due",       color: "bg-orange-50 text-orange-600 border-orange-200", icon: AlertCircle },
  COMPLETED:        { label: "Completed",         color: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle },
  EXPIRED:          { label: "Expired",           color: "bg-gray-100 text-gray-600 border-gray-200",      icon: XCircle },
  CANCELLED:        { label: "Cancelled",         color: "bg-red-50 text-red-600 border-red-200",          icon: XCircle },
  REFUNDED:         { label: "Refunded",          color: "bg-purple-50 text-purple-700 border-purple-200", icon: RotateCcw },
}

function StatusBadge({ status }: { status: PreOrderStatus }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: AlertCircle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

function PreOrderSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <div className="h-3.5 bg-gray-100 rounded w-40" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="flex gap-3 mb-4">
        <div className="w-14 h-14 bg-gray-100 rounded-xl" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3.5 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

export default function MyPreOrdersPage() {
  const router = useRouter()
  const [items, setItems] = useState<PreOrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    PreOrderService.getMine()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Pre-Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track your bookings and pay balances</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <PreOrderSkeleton key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !items.length && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4">
              <Clock size={32} className="text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No pre-orders yet</h2>
            <p className="text-sm text-gray-500 mb-6">Book an upcoming product and it'll show up here.</p>
            <Link
              href="/pre-orders"
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              Browse Pre-Orders
            </Link>
          </div>
        )}

        {/* Pre-orders list */}
        {!loading && items.length > 0 && (
          <div className="space-y-4">
            {items.map((po) => {
              const date = new Date(po.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })

              return (
                <Link
                  key={po.id}
                  href={`/account/pre-orders/${po.id}`}
                  className="group block bg-white border border-gray-100 rounded-2xl p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">PRE-ORDER</p>
                      <p className="font-mono text-xs text-gray-600 truncate max-w-[180px]">
                        #{po.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{date}</p>
                    </div>
                    <StatusBadge status={po.status} />
                  </div>

                  {/* Product */}
                  <div className="flex gap-3 mb-4">
                    <img
                      src={po.product.images?.[0]?.url || "/placeholder.png"}
                      alt={po.product.name}
                      className="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                        {po.product.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {po.variant?.name ? `${po.variant.name} · ` : ""}Qty {po.quantity} · Booking {inr(po.bookingAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        Qty {po.quantity}
                      </span>
                      <span className="text-gray-200">•</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {inr(po.totalAmount)}
                      </span>
                    </div>

                    {po.status === "AWAITING_BALANCE" && po.balanceToken ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          router.push(`/pre-orders/pay/${po.balanceToken}`)
                        }}
                        className="inline-flex items-center bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
                      >
                        Pay {inr(po.balanceAmount)}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                        View details <ChevronRight size={13} />
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
