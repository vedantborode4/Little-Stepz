"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface Props { order: any; onClose: () => void }

export default function OrderDetailsDrawer({ order, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", outside)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc) }
  }, [onClose])

  if (!order) return null

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
          <div className="bg-surface-2 rounded-xl p-4 space-y-2 border border-border">
            <InfoRow label="Order ID" value={order.id} />
            <InfoRow label="Customer" value={order.user?.name} />
            <InfoRow label="Total" value={`₹${order.total}`} highlight />
            <InfoRow label="Payment Status" value={order.payment?.status} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-muted uppercase tracking-wide mb-3">Items</h3>
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-border hover:shadow-sm transition bg-surface">
                  <div>
                    <p className="text-sm font-medium">{item.product?.name}</p>
                    <p className="text-xs text-muted">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">₹{item.price * item.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-muted shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${highlight ? "text-text text-base font-semibold" : ""}`}>{value}</span>
    </div>
  )
}
