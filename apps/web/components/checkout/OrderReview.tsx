"use client"

import Image from "next/image"
import { useCartStore } from "../../store/useCartStore"

export default function OrderReview() {
  const items = useCartStore((s) => s.items)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3.5 py-3 border-b border-gray-100 last:border-none">
          <div className="relative w-14 h-14 bg-gray-50 rounded-xl border border-gray-100 flex-shrink-0 overflow-hidden">
            <Image
              src={item.product.images?.[0]?.url || "/placeholder.png"}
              alt={item.product.name}
              fill
              className="object-contain p-1"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
              {item.product.name}
            </p>
            {item.variant && (
              <span className="inline-block mt-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                {item.variant.name}
              </span>
            )}
            <p className="text-xs text-gray-400 mt-1">Qty: {item.quantity}</p>
          </div>

          <div className="text-sm font-bold text-gray-900 flex-shrink-0 self-center">
            ₹{item.subtotal?.toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  )
}
