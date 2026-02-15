"use client"

import { useState, useMemo } from "react"
import { Product } from "../../../types/product"
import { Heart } from "lucide-react"
import { useCartStore } from "../../../store/useCartStore"
import { useWishlistStore } from "../../../store/useWishlistStore"
import { toast } from "sonner"

export default function ProductInfo({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)

  const [selectedVariant, setSelectedVariant] = useState(
    product.variants?.[0] || null
  )

  const addItem = useCartStore((s) => s.addItem)

  const toggleWishlist = useWishlistStore((s) => s.toggle)

  const isInWishlist = useWishlistStore((s) =>
    s.isInWishlist(product.id)
  )

  const displayPrice = useMemo(() => {
    if (!selectedVariant) return product.price
    return selectedVariant.price ?? product.price
  }, [selectedVariant, product.price])

  const inStock = useMemo(() => {
    if (!selectedVariant) return product.inStock
    return selectedVariant.stock > 0
  }, [selectedVariant, product.inStock])

  const handleAddToCart = async () => {
    await addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      quantity,
    })

    toast.success("Added to cart")
  }

  const handleWishlist = () => {
    toggleWishlist(product.id)

    toast.success(
      isInWishlist
        ? "Removed from wishlist"
        : "Added to wishlist"
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>

        <button
          onClick={handleWishlist}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-border hover:bg-gray-50 transition"
        >
          <Heart
            className={`w-5 h-5 ${
              isInWishlist ? "fill-primary text-primary" : ""
            }`}
          />
        </button>
      </div>

      <div className="text-2xl font-semibold text-primary">
        ₹{displayPrice}
      </div>

      <p className={`text-sm ${inStock ? "text-green-600" : "text-red-500"}`}>
        {inStock ? "In stock" : "Out of stock"}
      </p>

      {product.variants?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Select Variant</p>

          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const active = selectedVariant?.id === variant.id

              return (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  className={`px-4 py-2 border rounded-lg text-sm transition
                  ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {variant.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <span className="text-sm">Quantity</span>

        <div className="flex items-center border rounded-lg">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-1"
          >
            -
          </button>

          <span className="px-4">{quantity}</span>

          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-1"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={!inStock}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:bg-gray-300"
      >
        Add to Cart
      </button>

      {product.description && (
        <div>
          <h3 className="font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted">{product.description}</p>
        </div>
      )}
    </div>
  )
}
