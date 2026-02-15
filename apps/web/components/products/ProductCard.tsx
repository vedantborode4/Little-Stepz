"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Product } from "../../types/product"
import { Heart } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import { toast } from "sonner"

interface Props {
  product: Product
}

export default function ProductCard({ product }: Props) {
  const router = useRouter()

  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggle)

  const isInWishlist = useWishlistStore((s) =>
    s.isInWishlist(product.id)
  )

  const image = product.images?.[0]?.url || "/placeholder.png"

  const handleAddToCart = async (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const variants = product.variants ?? []

      // ✅ NO VARIANTS
      if (variants.length === 0) {
        await addItem({
          productId: product.id,
          quantity: 1,
        })

        toast.success("Added to cart")
        return
      }

      // ✅ SINGLE VARIANT → AUTO ADD
      if (variants.length === 1) {
        const variant = variants[0]
        if (!variant) return

        await addItem({
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
        })

        toast.success("Added to cart")
        return
      }

      // ✅ MULTIPLE VARIANTS → REDIRECT
      router.push(`/products/${product.slug}`)
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to add to cart"
      )
    }
  }

  const handleWishlist = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist(product.id)
  }

  const hasMultipleVariants = (product.variants?.length ?? 0) > 1

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-white rounded-xl shadow-card hover:shadow-lg transition overflow-hidden"
    >
      <div className="relative aspect-square bg-gray-50">
        <Image
          src={image}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-105 transition"
        />

        <button
          onClick={handleWishlist}
          className="absolute top-3 right-3 bg-white rounded-full p-2 shadow hover:scale-110 transition"
        >
          <Heart
            className={`w-4 h-4 ${
              isInWishlist ? "fill-primary text-primary" : ""
            }`}
          />
        </button>
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-sm font-medium line-clamp-2 min-h-[40px]">
          {product.name}
        </h3>

        <span className="text-primary font-semibold">
          ₹{product.price}
        </span>

        <button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className="w-full mt-2 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {hasMultipleVariants
            ? "Select Options"
            : product.inStock
            ? "Add to Cart"
            : "Out of Stock"}
        </button>
      </div>
    </Link>
  )
}
