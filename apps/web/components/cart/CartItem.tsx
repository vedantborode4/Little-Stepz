"use client"

import Image from "next/image"
import Link from "next/link"
import { Trash2, Minus, Plus } from "lucide-react"
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
      className={`flex gap-4 p-5 border-b border-gray-100 last:border-none transition-opacity ${
        isUpdating ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Image */}
      <Link href={`/products/${item.product.slug}`} className="flex-shrink-0">
        <div className="relative w-20 h-20 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
          <Image src={image} alt={item.product.name} fill className="object-contain p-1" />
        </div>
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link href={`/products/${item.product.slug}`}>
          <h3 className="font-semibold text-gray-900 text-sm hover:text-primary transition leading-snug line-clamp-2">
            {item.product.name}
          </h3>
        </Link>

        {item.variant && (
          <span className="inline-block mt-1 text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
            {item.variant.name}
          </span>
        )}

        {/* Price */}
        <p className="text-sm font-bold text-gray-900 mt-1.5">
          ₹{(Number(item.product.price) * item.quantity).toLocaleString("en-IN")}

          (₹{Number(item.product.price).toLocaleString("en-IN")} each)
          {item.quantity > 1 && (
            <span className="text-xs font-normal text-gray-400 ml-1.5">
              (₹{item.product.price} each)
            </span>
          )}
        </p>

        {/* Quantity control */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
              disabled={isUpdating || item.quantity <= 1}
              onClick={() => updateQuantity(item.productId, variantId, item.quantity - 1)}
              className="p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <Minus size={13} />
            </button>
            <span className="px-3.5 text-sm font-semibold text-gray-900">{item.quantity}</span>
            <button
              disabled={isUpdating}
              onClick={() => updateQuantity(item.productId, variantId, item.quantity + 1)}
              className="p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <Plus size={13} />
            </button>
          </div>

          <button
            disabled={isUpdating}
            onClick={() => removeItem(item.productId, variantId)}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
