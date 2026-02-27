"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface Props {
  order: any
  onClose: () => void
}

export default function OrderDetailsDrawer({ order, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEsc)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  if (!order) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-400/70 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200" />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-[440px] bg-white z-50 shadow-2xl 
        border-l border-gray-200
        transform transition-transform duration-300 ease-out
        animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold tracking-tight">
            Order Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6   overflow-y-auto h-[calc(100%-72px)]">
          {/* Order Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-300">
            <InfoRow label="Order ID" value={order.id} />
            <InfoRow label="Customer" value={order.user?.name} />
            <InfoRow label="Total" value={`₹${order.total}`} highlight />
            <InfoRow label="Payment Status" value={order.payment?.status} />
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
              Items
            </h3>

            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 rounded-lg border border-gray-200 hover:shadow-sm transition bg-white"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {item.product?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    ₹{item.price * item.quantity}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={`font-medium ${
          highlight ? "text-black text-base font-semibold" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}