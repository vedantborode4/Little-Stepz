"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Package, MapPin, CreditCard, Truck } from "lucide-react"
import { AdminOrderService } from "../../../../lib/services/admin-order.service"
import OrderStatusBadge from "../../../../components/admin/orders/OrderStatusBadge"
import ShipOrderButton from "../../../../components/admin/orders/ShipOrderButton"
import OrderTimeline from "../../../../components/admin/orders/AdminOrderTimeline"

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      // Fetch list filtered to recent orders and find by id
      // (no dedicated single-order admin endpoint)
      const res = await AdminOrderService.getOrders({ limit: 50 })
      const found = (res.orders ?? []).find((o: any) => o.id === id)
      if (found) {
        setOrder(found)
      } else {
        // Not in first page — fetch more pages until found
        let found2: any = null
        for (let p = 2; p <= (res.pages ?? 1) && !found2; p++) {
          const r2 = await AdminOrderService.getOrders({ page: p, limit: 50 })
          found2 = (r2.orders ?? []).find((o: any) => o.id === id)
        }
        setOrder(found2 ?? null)
      }
    } catch { router.push("/admin/orders") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-100 rounded-xl w-40" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl"/>)}
      </div>
    </div>
  )

  if (!order) return (
    <div className="text-center py-20 text-gray-400">Order not found</div>
  )

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <ShipOrderButton orderId={order.id} currentStatus={order.status} onSuccess={load} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Order Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Package size={16} className="text-primary" />
            Order Info
          </div>
          {[
            { label: "Customer", value: order.user?.name || "—" },
            { label: "Email", value: order.user?.email || "—" },
            { label: "Total", value: `₹${order.total}`, bold: true },
            { label: "Payment", value: order.payment?.status || "—" },
            { label: "Method", value: order.payment?.method || "—" },
          ].map(({ label, value, bold }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className={bold ? "font-bold text-gray-900" : "font-medium text-gray-700"}>{value}</span>
            </div>
          ))}
        </div>

        {/* Address */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <MapPin size={16} className="text-primary" />
            Delivery Address
          </div>
          {order.address ? (
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{order.address.name}</p>
              <p>{order.address.line1}</p>
              {order.address.line2 && <p>{order.address.line2}</p>}
              <p>{order.address.city}, {order.address.state} {order.address.pincode}</p>
              <p className="text-gray-500">{order.address.phone}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No address on file</p>
          )}
        </div>

        {/* Timeline - matching Image 4 UI */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Truck size={16} className="text-primary" />
            Order Timeline
          </div>
          <OrderTimeline status={order.status} createdAt={order.createdAt} />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Order Items</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-500 text-left">
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">Variant</th>
              <th className="p-4 font-medium">Qty</th>
              <th className="p-4 font-medium">Unit Price</th>
              <th className="p-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item: any) => (
              <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.product?.images?.[0]?.url || "/placeholder.png"}
                      className="w-10 h-10 rounded-lg object-cover border border-gray-100"
                      alt={item.product?.name}
                    />
                    <span className="font-medium text-gray-900">{item.product?.name || "—"}</span>
                  </div>
                </td>
                <td className="p-4 text-gray-500">{item.variant?.name || "—"}</td>
                <td className="p-4 text-gray-700">{item.quantity}</td>
                <td className="p-4 text-gray-700">₹{item.price}</td>
                <td className="p-4 font-semibold text-gray-900 text-right">₹{(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-100">
            <tr>
              <td colSpan={4} className="p-4 text-right font-semibold text-gray-700">Order Total</td>
              <td className="p-4 text-right font-bold text-lg text-gray-900">₹{order.total?.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
