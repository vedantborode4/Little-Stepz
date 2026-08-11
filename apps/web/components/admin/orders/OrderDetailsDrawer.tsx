"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import Link from "next/link"
import { AdminOrderService, type AdminOrderDetail } from "../../../lib/services/admin-order.service"

interface Props { orderId: string; onClose: () => void }

/**
 * The drawer used to render whatever the orders *list* returned, which carries no
 * items and no address — so "Items" was always empty and there was nothing to ship
 * to. It now fetches the order in full.
 */
export default function OrderDetailsDrawer({ orderId, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", outside)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc) }
  }, [onClose])

  useEffect(() => {
    let active = true
    setLoading(true); setFailed(false)
    AdminOrderService.getById(orderId)
      .then((d) => { if (active) setOrder(d) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [orderId])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200" />
      <div ref={drawerRef}
        className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-surface z-50 shadow-2xl border-l border-border transform transition-transform duration-300 ease-out animate-in slide-in-from-right flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-surface-2 shrink-0">
          <h2 className="text-base font-semibold">Order Details</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-3 transition"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-28 bg-surface-2 rounded-xl" />
              <div className="h-20 bg-surface-2 rounded-xl" />
              <div className="h-20 bg-surface-2 rounded-xl" />
            </div>
          )}

          {failed && <p className="text-sm text-faint">Couldn't load this order.</p>}

          {order && (
            <>
              <div className="bg-surface-2 rounded-xl p-4 space-y-2 border border-border">
                <InfoRow label="Order ID" value={`#${order.id.slice(-8).toUpperCase()}`} />
                <InfoRow label="Placed" value={new Date(order.createdAt).toLocaleString()} />
                <InfoRow label="Customer" value={order.user?.name} />
                <InfoRow label="Email" value={order.user?.email} />
                {order.user?.phone && <InfoRow label="Phone" value={order.user.phone} />}
                <InfoRow label="Total" value={`₹${order.total.toLocaleString()}`} highlight />
                <InfoRow label="Payment" value={`${order.payment?.method ?? "—"} · ${order.payment?.status ?? "—"}`} />
                {order.shipments[0]?.awbCode && (
                  <InfoRow label="AWB" value={order.shipments[0].awbCode} />
                )}
              </div>

              <Section title="Delivery Address">
                {order.address ? (
                  <div className="text-sm text-muted space-y-0.5 p-3 rounded-lg border border-border bg-surface">
                    <p className="font-medium text-text">{order.address.name}</p>
                    <p>{order.address.address}</p>
                    <p>{order.address.city}, {order.address.state} {order.address.pincode}</p>
                    <p>{order.address.country}</p>
                    <p>{order.address.phone}</p>
                  </div>
                ) : (
                  <p className="text-sm text-faint">No address on file</p>
                )}
              </Section>

              <Section title="Items">
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center gap-3 p-3 rounded-lg border border-border hover:shadow-sm transition bg-surface">
                      <img src={item.image || "/placeholder.webp"} alt={item.productName}
                        className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        {item.variantName && <p className="text-xs text-faint">{item.variantName}</p>}
                        <p className="text-xs text-muted">Qty: {item.quantity} × ₹{item.price.toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">₹{item.subtotal.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="bg-surface-2 rounded-xl p-4 space-y-2 border border-border">
                <InfoRow label="Subtotal" value={`₹${order.subtotal.toLocaleString()}`} />
                {order.discount > 0 && (
                  <InfoRow
                    label={`Discount${order.coupon ? ` (${order.coupon.code})` : ""}`}
                    value={`−₹${order.discount.toLocaleString()}`}
                  />
                )}
                <InfoRow label="Shipping" value={`₹${order.shippingCharges.toLocaleString()}`} />
                <InfoRow label="Total" value={`₹${order.total.toLocaleString()}`} highlight />
              </div>

              <Link href={`/admin/orders/${order.id}`}
                className="block text-center text-sm font-medium text-primary hover:underline">
                Open full order page →
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-muted uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-muted shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${highlight ? "text-text text-base font-semibold" : ""}`}>{value || "—"}</span>
    </div>
  )
}
