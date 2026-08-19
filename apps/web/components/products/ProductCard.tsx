"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Product } from "../../types/product"
import { getDisplayPrices, getPriceRange, formatINR } from "../../lib/pricing"
import { cldFill } from "../../lib/utils/cloudinaryUrl"
import PriceTag from "./PriceTag"
import ProductShare from "./ProductShare"
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

  const cardRef = useRef<HTMLAnchorElement>(null)
  const [transform, setTransform] = useState("")

  const MAX_TILT = 9
  const HOVER_SCALE = 1.04

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const ry = (px - 0.5) * 2 * MAX_TILT
    const rx = -(py - 0.5) * 2 * MAX_TILT
    setTransform(
      `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${HOVER_SCALE})`
    )
  }

  const handleMouseEnter = () => setTransform(`perspective(1000px) scale(${HOVER_SCALE})`)
  const handleMouseLeave = () =>
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)")

  const image = cldFill(product.images?.[0]?.url || "/placeholder.webp")
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const priceRange = getPriceRange(product, variants)
  // Fail closed. Defaulting a missing availability flag to "in stock" enables Add
  // to Cart on something we cannot confirm is sellable; every product endpoint
  // selects `inStock`, so an absent value means the payload is wrong, not that the
  // item is available.
  const inStock = product.inStock ?? false
  const isPreOrder = !inStock && !!product.preOrderEnabled && product.bookingAmount != null

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Products with variants send the shopper to the PDP to choose (or keep the
    // base). Only variant-less products add directly from the card.
    if (hasVariants) {
      router.push(`/products/${product.slug}`)
      return
    }

    try {
      setIsAdding(true)
      await addItem({ productId: product.id, quantity: 1 })
      toast.success("Added to cart")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Link
      ref={cardRef}
      href={`/products/${product.slug}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ transform }}
      className="group relative h-full flex flex-col bg-surface rounded-xl border border-border shadow-card hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.22)] hover:border-primary/20 transition-[transform,box-shadow,border-color] duration-150 ease-out will-change-transform overflow-hidden"
    >
      {/* IMAGE */}
      <div className="relative w-full aspect-square bg-surface-2 overflow-hidden rounded-t-xl">
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
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
        />

        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-surface/90 backdrop-blur-sm rounded-full p-1.5 sm:p-2 shadow transition-transform duration-200 hover:scale-110 hover:text-primary active:scale-90"
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${isInWishlist ? "fill-primary text-primary" : ""}`}
          />
        </button>

        {/* Quick share — always on mobile, hover-reveal on desktop */}
        <ProductShare
          slug={product.slug}
          name={product.name}
          className="absolute right-2 sm:right-3 top-11 sm:top-14 z-10 flex flex-col gap-1.5 transition-opacity duration-200 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          buttonClassName="bg-surface/90 backdrop-blur-sm rounded-full p-1.5 sm:p-2 shadow text-muted hover:text-primary hover:scale-110 active:scale-90 transition"
          iconSize={14}
        />
      </div>

      {/* CONTENT */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-4">
        <h3 className="text-xs sm:text-sm font-medium line-clamp-2 min-h-8.5 sm:min-h-10 leading-snug transition-colors group-hover:text-primary">
          {product.name}
        </h3>

        {hasVariants && !priceRange.single ? (
          <p className="mb-2 sm:mb-3 mt-0.5 text-sm sm:text-base font-bold text-text">
            From {formatINR(priceRange.min)}
          </p>
        ) : (
          <PriceTag prices={getDisplayPrices(product)} className="mb-2 sm:mb-3 mt-0.5" />
        )}

        {isPreOrder ? (
          <button
            onClick={(e) => { e.preventDefault(); router.push(`/products/${product.slug}`) }}
            className="group/btn relative overflow-hidden mt-auto w-full bg-primary text-white py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-linear-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
            <span className="relative flex items-center justify-center gap-1.5">Pre-Order</span>
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding}
            className="group/btn relative overflow-hidden mt-auto w-full bg-primary text-white py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium disabled:bg-surface-3"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-linear-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
            <span className="relative flex items-center justify-center gap-1.5 sm:gap-2">
              {isAdding && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />}
              {!inStock
                ? "Out of Stock"
                : hasVariants
                  ? "Select Options"
                  : isAdding
                    ? "Adding…"
                    : "Add to Cart"}
            </span>
          </button>
        )}
      </div>

      {/* Red bottom accent on hover (~3px, animated from the left) */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out" />
    </Link>
  )
}
