"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Product } from "../../types/product"
import { getDisplayPrices } from "../../lib/pricing"
import PriceTag from "./PriceTag"
import { Heart, Loader2 } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import { toast } from "sonner"

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggle)
  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))
  const [isAdding, setIsAdding] = useState(false)

  const image = product.images?.[0]?.url || "/placeholder.png"
  const variants = product.variants ?? []
  const hasMultipleVariants = variants.length > 1
  const inStock = product.inStock ?? true
  const isPreOrder = !inStock && !!product.preOrderEnabled && product.bookingAmount != null

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (hasMultipleVariants) {
      router.push(`/products/${product.slug}`)
      return
    }

    try {
      setIsAdding(true)
      await addItem({ productId: product.id, variantId: variants[0]?.id, quantity: 1 })
      toast.success("Added to cart")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group h-full flex flex-col bg-white rounded-xl shadow-card hover:shadow-lg transition overflow-hidden"
    >
      {/* IMAGE */}
      <div className="relative w-full aspect-square bg-white">
        {isPreOrder && (
          <span className="absolute top-2 left-2 z-10 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
            Pre-Order
          </span>
        )}
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 50vw"
          className="object-contain p-2 sm:p-4 group-hover:scale-105 transition"
        />

        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white rounded-full p-1.5 sm:p-2 shadow"
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInWishlist ? "fill-primary text-primary" : ""}`}
          />
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-4">
        <h3 className="text-xs sm:text-sm font-medium line-clamp-2 min-h-8.5 sm:min-h-10 leading-snug">
          {product.name}
        </h3>

        <PriceTag prices={getDisplayPrices(product)} className="mb-2 sm:mb-3 mt-0.5" />

        {isPreOrder ? (
          <button
            onClick={(e) => { e.preventDefault(); router.push(`/products/${product.slug}`) }}
            className="mt-auto w-full bg-primary text-white py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5"
          >
            Pre-Order
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding}
            className="mt-auto w-full bg-primary text-white py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 disabled:bg-gray-300"
          >
            {isAdding && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />}
            {hasMultipleVariants ? "Select Options" : isAdding ? "Adding…" : "Add to Cart"}
          </button>
        )}
      </div>
    </Link>
  )
}
