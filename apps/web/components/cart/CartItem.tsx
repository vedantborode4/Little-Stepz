"use client"

import Image from "next/image"
import Link from "next/link"
import { Trash2, Minus, Plus } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import { getChargedPrice, getDisplayPrices, formatINR } from "../../lib/pricing"
import PriceTag from "../products/PriceTag"
import { cldFill } from "../../lib/utils/cloudinaryUrl"
import type { CartItem as CartItemType } from "../../types/cart"

export default function CartItem({ item }: { item: CartItemType }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const updatingKey = useCartStore((s) => s.updatingKey)

  const variantId = item.variantId ?? undefined
  const key = `${item.productId}-${variantId ?? "no-variant"}`
  const isUpdating = updatingKey === key

  const image = cldFill(item.variant?.images?.[0]?.url || item.product.images?.[0]?.url || "/placeholder.png", 200)
  const unitPrice = getChargedPrice(item.product, item.variant)
  const lineTotal = unitPrice * item.quantity
  const unitPrices = getDisplayPrices(item.product, item.variant)

  return (
    <div
      className={`group relative flex gap-4 sm:gap-5 px-5 py-4 border-b border-gray-100 last:border-none transition-all duration-200 hover:bg-gray-50/60 ${
        isUpdating ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Product image */}
      <Link
        href={`/products/${item.product.slug}`}
        className="flex-shrink-0 self-start"
      >
        <div className="relative w-[84px] h-[84px] rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow duration-200">
          <Image
            src={image}
            alt={item.product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </Link>

      {/* Info + controls */}
      <div className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

        {/* Left — name, variant, unit price */}
        <div className="flex-1 min-w-0">
          <Link href={`/products/${item.product.slug}`}>
            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-primary transition-colors duration-150">
              {item.product.name}
            </h3>
          </Link>

          {item.variant && (
            <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
              {item.variant.name}
            </span>
          )}

          <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 font-medium">
            <PriceTag prices={unitPrices} /> <span>each</span>
          </div>

          {/* Qty stepper + remove — on mobile stays here */}
          <div className="flex items-center gap-3 mt-3 sm:mt-2.5">
            {/* Stepper */}
            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button
                disabled={isUpdating || item.quantity <= 1}
                onClick={() =>
                  updateQuantity(item.productId, variantId, item.quantity - 1)
                }
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-primary hover:text-white disabled:opacity-30 transition-colors duration-150"
              >
                <Minus size={12} />
              </button>
              <span className="w-8 text-center text-sm font-bold text-gray-900 select-none">
                {item.quantity}
              </span>
              <button
                disabled={isUpdating}
                onClick={() =>
                  updateQuantity(item.productId, variantId, item.quantity + 1)
                }
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-primary hover:text-white disabled:opacity-30 transition-colors duration-150"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Remove */}
            <button
              disabled={isUpdating}
              onClick={() => removeItem(item.productId, variantId)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-30"
              aria-label="Remove item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Right — line total */}
        <div className="flex-shrink-0 text-right sm:pl-4 mt-1 sm:mt-0">
          <p className="text-base font-bold text-gray-900">
            ₹{lineTotal.toLocaleString("en-IN")}
          </p>
          {item.quantity > 1 && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {item.quantity} × {formatINR(unitPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}