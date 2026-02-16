"use client"

import Image from "next/image"
import { Trash2 } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import type { CartItem as CartItemType } from "../../types/cart"

export default function CartItem({ item }: { item: CartItemType }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const updatingKey = useCartStore((s) => s.updatingKey)

  const variantId = item.variantId ?? undefined
  const key = `${item.productId}-${variantId ?? "no-variant"}`
  const isUpdating = updatingKey === key

  const image = item.product.images?.[0]?.url || "/placeholder.png"

  return (
    <div
      className={`flex gap-4 p-4 border-b last:border-none transition ${
        isUpdating ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden">
        <Image src={image} alt={item.product.name} fill className="object-contain" />
      </div>

      <div className="flex-1">
        <h3 className="font-medium">{item.product.name}</h3>

        {item.variant && (
          <p className="text-sm text-muted">{item.variant.name}</p>
        )}

        <div className="mt-2 font-semibold">
          ₹{item.product.price}
        </div>

        <div className="flex items-center gap-3 mt-2">
          <button
            disabled={isUpdating || item.quantity <= 1}
            onClick={() =>
              updateQuantity(item.productId, variantId, item.quantity - 1)
            }
            className="px-2 border rounded disabled:opacity-50"
          >
            −
          </button>

          <span>{item.quantity}</span>

          <button
            disabled={isUpdating}
            onClick={() =>
              updateQuantity(item.productId, variantId, item.quantity + 1)
            }
            className="px-2 border rounded disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      <button
        disabled={isUpdating}
        onClick={() => removeItem(item.productId, variantId)}
        className="text-muted hover:text-red-500 disabled:opacity-50"
      >
        <Trash2 size={18} />
      </button>
    </div>
  )
}
