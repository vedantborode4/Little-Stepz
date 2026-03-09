"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useOrderStore } from "../../../store/useOrderStore"
import { useCartStore } from "../../../store/useCartStore"
import { CheckCircle, Package, MapPin, ArrowRight, ShoppingBag } from "lucide-react"
import Link from "next/link"
import confetti from "canvas-confetti"

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>()
  const { currentOrder, fetchOrderById, loading } = useOrderStore()

  useEffect(() => {
    if (id) {
      fetchOrderById(id)
      // Clear cart since order is placed
      useCartStore.getState().clearCart()
    }
    // Confetti burst
    const t = setTimeout(() => {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.55 }, colors: ["#FF383C", "#4ECDC4", "#FFD700"] })
    }, 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const o = currentOrder

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-5">

        {/* Hero card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-card text-center space-y-4">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Placed! 🎉</h1>
            <p className="text-sm text-muted mt-1">
              Thank you for shopping with Little Stepz. We'll get this packed right away!
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3 inline-block">
            <p className="text-xs text-muted">Order ID</p>
            <p className="font-mono font-semibold text-gray-800 text-sm mt-0.5">{id}</p>
          </div>
        </div>

        {/* Order summary */}
        {loading && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        )}

        {o && !loading && (
          <>
            {/* Items */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Package size={15} className="text-primary" />
                <h2 className="font-semibold text-gray-900 text-sm">
                  {o.items?.length ?? 0} {o.items?.length === 1 ? "Item" : "Items"} Ordered
                </h2>
              </div>
              <div className="space-y-3">
                {o.items?.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.product?.images?.[0]?.url ? (
                      <img
                        src={item.product.images[0].url}
                        alt={item.product.name}
                        className="w-11 h-11 object-cover rounded-lg border border-gray-100"
                      />
                    ) : (
                      <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package size={14} className="text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name}</p>
                      <p className="text-xs text-muted">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      ₹{Number(item.total ?? item.subtotal).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
                {(o.items?.length ?? 0) > 3 && (
                  <p className="text-xs text-muted text-center pt-1">
                    +{o.items.length - 3} more items
                  </p>
                )}
              </div>
            </div>

            {/* Totals + Delivery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-card">
                <p className="text-xs text-muted mb-1">Order Total</p>
                <p className="text-xl font-bold text-gray-900">
                  ₹{Number(o.total).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted mt-1 capitalize">
                  via {o.paymentMethod?.replace(/_/g, " ") ?? "—"}
                </p>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-card">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={12} className="text-primary" />
                  <p className="text-xs text-muted">Delivering to</p>
                </div>
                {o.shippingAddress ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{o.shippingAddress.name}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">
                      {o.shippingAddress.city}, {o.shippingAddress.state}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/account/orders/${id}`}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            Track Order <ArrowRight size={15} />
          </Link>
          <Link
            href="/products"
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            <ShoppingBag size={15} /> Continue Shopping
          </Link>
        </div>

      </div>
    </div>
  )
}
