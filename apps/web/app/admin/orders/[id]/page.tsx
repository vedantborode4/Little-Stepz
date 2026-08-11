"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Package, MapPin, CreditCard, Truck } from "lucide-react"
import { AdminOrderService, type AdminOrderDetail } from "../../../../lib/services/admin-order.service"
import OrderStatusBadge from "../../../../components/admin/orders/OrderStatusBadge"
import ShipOrderButton from "../../../../components/admin/orders/ShipOrderButton"
import CancelShipmentButton from "../../../../components/admin/orders/CancelShipmentButton"
import OrderTimeline from "../../../../components/admin/orders/AdminOrderTimeline"

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Previously this paged through GET /admin/orders looking for the id, which
  // meant the page only ever had the list payload — no items, no address.
  const load = async () => {
    try {
      setOrder(await AdminOrderService.getById(id))
    } catch { router.push("/admin/orders") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-surface-2 rounded-xl w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-surface-2 rounded-2xl"/>)}
      </div>
    </div>
  )

  if (!order) return (
    <div className="text-center py-20 text-faint">Order not found</div>
  )

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-2 text-muted transition shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-text truncate">
              Order #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-xs sm:text-sm text-muted">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          <OrderStatusBadge status={order.status} />
          <ShipOrderButton orderId={order.id} currentStatus={order.status} onSuccess={load} />
          <CancelShipmentButton orderId={order.id} currentStatus={order.status} onSuccess={load} />
        </div>
      </div>

      {/* Info cards — stack on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* Order Info */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted mb-3">
            <Package size={16} className="text-primary" />
            Order Info
          </div>
          {[
            { label: "Customer", value: order.user?.name || "—" },
            { label: "Email",    value: order.user?.email || "—" },
            { label: "Total",    value: `₹${order.total}`, bold: true },
            { label: "Payment",  value: order.payment?.status || "—" },
            { label: "Method",   value: order.payment?.method || "—" },
            { label: "Courier",  value: order.shipments[0]?.courierName || "—" },
            { label: "AWB",      value: order.shipments[0]?.awbCode || "—" },
          ].map(({ label, value, bold }) => (
            <div key={label} className="flex justify-between text-sm gap-2">
              <span className="text-muted shrink-0">{label}</span>
              <span className={`text-right truncate ${bold ? "font-bold text-text" : "font-medium text-muted"}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Address */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted mb-3">
            <MapPin size={16} className="text-primary" />
            Delivery Address
          </div>
          {order.address ? (
            <div className="text-sm text-muted space-y-1">
              <p className="font-medium text-text">{order.address.name}</p>
              <p>{order.address.address}</p>
              <p>{order.address.city}, {order.address.state} {order.address.pincode}</p>
              <p>{order.address.country}</p>
              <p className="text-muted">{order.address.phone}</p>
            </div>
          ) : (
            <p className="text-sm text-faint">No address on file</p>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted mb-4">
            <Truck size={16} className="text-primary" />
            Order Timeline
          </div>
          <OrderTimeline status={order.status} createdAt={order.createdAt} />
        </div>
      </div>

      {/* Items table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Order Items</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr className="text-muted text-left">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Variant</th>
                <th className="p-4 font-medium">Qty</th>
                <th className="p-4 font-medium">Unit Price</th>
                <th className="p-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-surface-2/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={item.image || "/placeholder.webp"}
                        className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" alt={item.productName}/>
                      <span className="font-medium text-text">{item.productName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted">{item.variantName || "—"}</td>
                  <td className="p-4 text-muted">{item.quantity}</td>
                  <td className="p-4 text-muted">₹{item.price.toLocaleString()}</td>
                  <td className="p-4 font-semibold text-text text-right">₹{item.subtotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr className="text-muted">
                <td colSpan={4} className="px-4 pt-4 text-right">Subtotal</td>
                <td className="px-4 pt-4 text-right">₹{order.subtotal.toLocaleString()}</td>
              </tr>
              {order.discount > 0 && (
                <tr className="text-muted">
                  <td colSpan={4} className="px-4 pt-1 text-right">
                    Discount{order.coupon ? ` (${order.coupon.code})` : ""}
                  </td>
                  <td className="px-4 pt-1 text-right">−₹{order.discount.toLocaleString()}</td>
                </tr>
              )}
              <tr className="text-muted">
                <td colSpan={4} className="px-4 pt-1 text-right">Shipping</td>
                <td className="px-4 pt-1 text-right">₹{order.shippingCharges.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={4} className="p-4 text-right font-semibold text-muted">Order Total</td>
                <td className="p-4 text-right font-bold text-lg text-text">₹{order.total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile item cards */}
        <div className="sm:hidden divide-y divide-border">
          {order.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-3">
              <img src={item.image || "/placeholder.webp"}
                className="w-12 h-12 rounded-xl object-cover border border-border shrink-0" alt={item.productName}/>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate text-sm">{item.productName}</p>
                {item.variantName && <p className="text-xs text-faint">{item.variantName}</p>}
                <p className="text-xs text-muted mt-0.5">Qty: {item.quantity} × ₹{item.price.toLocaleString()}</p>
              </div>
              <p className="font-bold text-text text-sm shrink-0">₹{item.subtotal.toLocaleString()}</p>
            </div>
          ))}
          <div className="p-4 space-y-1 bg-surface-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span><span>₹{order.subtotal.toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>Discount{order.coupon ? ` (${order.coupon.code})` : ""}</span>
                <span>−₹{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>Shipping</span><span>₹{order.shippingCharges.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-semibold text-muted">Order Total</span>
              <span className="font-bold text-lg text-text">₹{order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
