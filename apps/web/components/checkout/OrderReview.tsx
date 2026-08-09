"use client"

import Image from "next/image"
import { useCartStore } from "../../store/useCartStore"
import { getDisplayPrices } from "../../lib/pricing"
import { cldFill } from "../../lib/utils/cloudinaryUrl"
import PriceTag from "../products/PriceTag"

export default function OrderReview() {
  const items = useCartStore((s) => s.items)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3.5 py-3 border-b border-border last:border-none">
          <div className="relative w-14 h-14 bg-surface-2 rounded-xl border border-border flex-shrink-0 overflow-hidden">
            <Image
              src={cldFill(item.variant?.images?.[0]?.url || item.product.images?.[0]?.url || "/placeholder.webp", 160)}
              alt={item.product.name}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text leading-snug line-clamp-2">
              {item.product.name}
            </p>
            {item.variant && (
              <span className="inline-block mt-0.5 text-[10px] font-medium bg-surface-2 text-faint px-1.5 py-0.5 rounded">
                {item.variant.name}
              </span>
            )}
            <div className="mt-1 flex items-center gap-1 text-xs text-faint">
              <PriceTag prices={getDisplayPrices(item.product, item.variant)} /> <span>· Qty: {item.quantity}</span>
            </div>
          </div>

          <div className="text-sm font-bold text-text flex-shrink-0 self-center">
            ₹{item.subtotal?.toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  )
}
