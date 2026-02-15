"use client"

import { useState } from "react"
import { Product } from "../../../types/product"
import { Heart } from "lucide-react"
import { useCartStore } from "../../../store/useCartStore"
import { useWishlistStore } from "../../../store/useWishlistStore"
import { toast } from "sonner"

export default function ProductInfo({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)

  const addItem = useCartStore((s) => s.addItem)

  const toggleWishlist = useWishlistStore((s) => s.toggle)
  const isInWishlist = useWishlistStore((s) =>
    s.isInWishlist(product.id)
  )

  const handleAddToCart = async () => {
    await addItem({
      productId: product.id,
      quantity,
    })
    toast.success("Added to cart")
  }

  return (
    <div className="space-y-6">

      {/* TITLE + WISHLIST */}
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>

        <button
          onClick={() => {
            toggleWishlist(product.id)
            toast.success(
              isInWishlist
                ? "Removed from wishlist"
                : "Added to wishlist"
            )
          }}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-border hover:bg-gray-50 transition"
        >
          <Heart
            className={`w-5 h-5 transition ${
              isInWishlist ? "fill-primary text-primary" : ""
            }`}
          />
        </button>
      </div>

      {/* PRICE */}
      <div className="text-2xl font-semibold text-primary">
        ₹{product.price}
      </div>

      {/* STOCK */}
      <p
        className={`text-sm ${
          product.inStock ? "text-green-600" : "text-red-500"
        }`}
      >
        {product.inStock ? "In stock" : "Out of stock"}
      </p>

      {/* QUANTITY */}
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

      {/* ADD TO CART */}
      <button
        onClick={handleAddToCart}
        disabled={!product.inStock}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:bg-gray-300"
      >
        Add to Cart
      </button>

      {/* DESCRIPTION */}
      {product.description && (
        <div>
          <h3 className="font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted">{product.description}</p>
        </div>
      )}
    </div>
  )
}
