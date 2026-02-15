"use client"

import Image from "next/image"
import { Trash2 } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"

export default function CartItem({ item }: any) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)

  const image = item.product.images?.[0]?.url || "/placeholder.png"

  return (
    <div className="flex gap-4 p-4 border-b last:border-none">
      <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden">
        <Image src={image} alt={item.product.name} fill className="object-contain" />
      </div>

      <div className="flex-1">
        <h3 className="font-medium">{item.product.name}</h3>
        <p className="text-sm text-muted">{item.variant?.name}</p>

        <div className="mt-2 font-semibold">₹{item.product.price}</div>

        {/* QTY */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() =>
              updateQuantity(item.productId, item.variantId, item.quantity - 1)
            }
            className="px-2 border rounded"
          >
            -
          </button>

          <span>{item.quantity}</span>

          <button
            onClick={() =>
              updateQuantity(item.productId, item.variantId, item.quantity + 1)
            }
            className="px-2 border rounded"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={() => removeItem(item.productId, item.variantId)}
        className="text-muted hover:text-red-500"
      >
        <Trash2 size={18} />
      </button>
    </div>
  )
}
