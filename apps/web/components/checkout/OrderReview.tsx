"use client"

import Image from "next/image"
import { useCartStore } from "../../store/useCartStore"

export default function OrderReview() {
  const items = useCartStore((s) => s.items)

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4 border-b pb-4">

          <div className="relative w-16 h-16 bg-gray-50 rounded-lg">
            <Image
              src={item.product.images?.[0]?.url || "/placeholder.png"}
              alt={item.product.name}
              fill
              className="object-contain"
            />
          </div>

          <div className="flex-1 text-sm">
            <p className="font-medium">{item.product.name}</p>

            {item.variant && (
              <p className="text-muted">{item.variant.name}</p>
            )}

            <p>Qty: {item.quantity}</p>
          </div>

          <div className="font-semibold">
            ₹{item.subtotal}
          </div>
        </div>
      ))}
    </div>
  )
}
