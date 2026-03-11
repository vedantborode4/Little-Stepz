"use client"

import AuthGuard from "../../../components/guard/AuthGuard"
import { useEffect } from "react"
import { useOrderStore } from "../../../store/useOrderStore"
import Link from "next/link"
import {
  Package, ChevronRight, ShoppingBag, Clock,
  CheckCircle, Truck, XCircle, RotateCcw, AlertCircle
} from "lucide-react"

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:          { label: "Pending",           color: "bg-amber-50 text-amber-700 border-amber-200",     icon: Clock },
  CONFIRMED:        { label: "Confirmed",         color: "bg-blue-50 text-blue-700 border-blue-200",        icon: CheckCircle },
  PROCESSING:       { label: "Processing",        color: "bg-blue-50 text-blue-700 border-blue-200",        icon: Package },
  SHIPPED:          { label: "Shipped",           color: "bg-violet-50 text-violet-700 border-violet-200",  icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for Delivery",  color: "bg-violet-50 text-violet-700 border-violet-200",  icon: Truck },
  DELIVERED:        { label: "Delivered",         color: "bg-green-50 text-green-700 border-green-200",     icon: CheckCircle },
  CANCELLED:        { label: "Cancelled",         color: "bg-red-50 text-red-600 border-red-200",           icon: XCircle },
  RETURN_REQUESTED: { label: "Return Requested",  color: "bg-orange-50 text-orange-600 border-orange-200",  icon: RotateCcw },
  RETURN_APPROVED:  { label: "Return Approved",   color: "bg-teal-50 text-teal-700 border-teal-200",        icon: RotateCcw },
  RETURNED:         { label: "Returned",          color: "bg-gray-100 text-gray-600 border-gray-200",       icon: RotateCcw },
  REFUNDED:         { label: "Refunded",          color: "bg-green-50 text-green-700 border-green-200",     icon: CheckCircle },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: AlertCircle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

function OrderSkeleton() {
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
        <div className="w-14 h-14 bg-gray-100 rounded-xl" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const { orders, fetchOrders, loading } = useOrderStore()

  useEffect(() => { fetchOrders() }, [])

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage your purchases</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <OrderSkeleton key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !orders.length && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={32} className="text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No orders yet</h2>
            <p className="text-sm text-gray-500 mb-6">When you place an order, it'll show up here.</p>
            <Link
              href="/products"
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              Start Shopping
            </Link>
          </div>
        )}

        {/* Orders list */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const images = order.items
                ?.map((i: any) => i.product?.images?.[0]?.url)
                .filter(Boolean)
                .slice(0, 3) ?? []
              const itemCount = order.items?.length ?? 0
              const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })

              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="group block bg-white border border-gray-100 rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">ORDER</p>
                      <p className="font-mono text-xs text-gray-600 truncate max-w-[180px]">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{date}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  {/* Product thumbnails */}
                  {images.length > 0 ? (
                    <div className="flex gap-2 mb-4">
                      {images.map((url: string, idx: number) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="w-14 h-14 object-cover rounded-xl border border-gray-100"
                        />
                      ))}
                      {itemCount > 3 && (
                        <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-400">+{itemCount - 3}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-4">
                      {Array.from({ length: Math.min(itemCount || 1, 2) }).map((_, i) => (
                        <div key={i} className="w-14 h-14 bg-gray-50 border border-dashed border-gray-200 rounded-xl flex items-center justify-center">
                          <Package size={16} className="text-gray-300" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bottom row */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </span>
                      <span className="text-gray-200">•</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₹{Number(order.total).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                      View details <ChevronRight size={13} />
                    </span>
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
