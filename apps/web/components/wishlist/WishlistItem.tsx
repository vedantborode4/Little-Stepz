"use client"

import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { ShoppingCart, Trash2 } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"

export default function WishlistItem({ item, onRemoved }: any) {
  const addItem = useCartStore((s) => s.addItem)
  const toggle = useWishlistStore((s) => s.toggle)

  const image = item.product.images?.[0]?.url || "/placeholder.png"

  const handleAddToCart = async () => {
    await addItem({ productId: item.product.id, quantity: 1 })
    toast.success("Added to cart")
  }

  const handleRemove = async () => {
    await toggle(item.product.id)
    onRemoved?.()
    toast.success("Removed from wishlist")
  }

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-none group">
      {/* Image */}
      <Link href={`/products/${item.product.slug}`} className="flex-shrink-0">
        <div className="relative w-18 h-18 w-[72px] h-[72px] bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group-hover:border-primary/30 transition">
          <Image
            src={image}
            alt={item.product.name}
            fill
            className="object-contain p-1.5"
          />
        </div>
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link href={`/products/${item.product.slug}`}>
          <h3 className="font-semibold text-sm text-gray-900 hover:text-primary transition leading-snug line-clamp-2">
            {item.product.name}
          </h3>
        </Link>

        {item.product.brand?.name && (
          <p className="text-xs text-gray-400 mt-0.5">{item.product.brand.name}</p>
        )}

        <p className="text-sm font-bold text-gray-900 mt-1.5">
          ₹{item.product.price?.toLocaleString("en-IN")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleAddToCart}
          className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          <ShoppingCart size={14} />
          <span className="hidden sm:inline">Add to Cart</span>
        </button>
        <button
          onClick={handleRemove}
          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition border border-gray-200"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
