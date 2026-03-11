"use client"

import { useState, useMemo } from "react"
import { Product } from "../../../types/product"
import { Heart, Loader2, Zap } from "lucide-react"
import { useCartStore } from "../../../store/useCartStore"
import { useWishlistStore } from "../../../store/useWishlistStore"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function ProductInfo({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggle)
  const router = useRouter()

  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))

  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)

  const [selectedVariant, setSelectedVariant] = useState(
    product.variants?.[0] || null
  )

  const displayPrice = useMemo(() => {
    if (!selectedVariant) return product.price
    return selectedVariant.price ?? product.price
  }, [selectedVariant, product.price])

  const inStock = useMemo(() => {
    if (!selectedVariant) return product.inStock
    return selectedVariant.stock > 0
  }, [selectedVariant, product.inStock])

  const maxStock = useMemo(() => {
    if (!selectedVariant) return product.quantity ?? 10
    return selectedVariant.stock
  }, [selectedVariant, product.quantity])

  const handleAddToCart = async () => {
    if (isAdding) return
    if (product.variants?.length > 1 && !selectedVariant) {
      toast.error("Please select a variant")
      return
    }
    try {
      setIsAdding(true)
      await addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      })
      toast.success("Added to cart")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add to cart")
    } finally {
      setIsAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (isBuyingNow) return
    if (product.variants?.length > 1 && !selectedVariant) {
      toast.error("Please select a variant")
      return
    }
    try {
      setIsBuyingNow(true)
      await addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      })
      router.push("/checkout")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to proceed to checkout")
      setIsBuyingNow(false)
    }
  }

  const handleWishlist = () => {
    toggleWishlist(product.id)
    toast.success(isInWishlist ? "Removed from wishlist" : "Added to wishlist")
  }

  return (
    <>
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="flex justify-between items-start gap-4">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <button
            onClick={handleWishlist}
            className="w-11 h-11 flex items-center justify-center rounded-full border border-border hover:bg-gray-50 transition"
          >
            <Heart
              className={`w-5 h-5 ${isInWishlist ? "fill-primary text-primary" : ""}`}
            />
          </button>
        </div>

        <div className="text-2xl font-semibold text-primary">
          &#8377;{displayPrice}
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
                    disabled={isAdding || isBuyingNow}
                    onClick={() => setSelectedVariant(variant)}
                    className={`px-4 py-2 border rounded-lg text-sm transition ${
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
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              disabled={isAdding || isBuyingNow || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-1 disabled:opacity-50"
            >
              -
            </button>
            <span className="px-4">{quantity}</span>
            <button
              disabled={isAdding || isBuyingNow || quantity >= maxStock}
              onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
              className="px-3 py-1 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="hidden lg:flex gap-3">
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding || isBuyingNow}
            className="flex-1 bg-primary opacity-75 text-white py-3 rounded-xl font-medium hover:opacity-65 transition disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAdding ? "Adding..." : "Add to Cart"}
          </button>

          <button
            onClick={handleBuyNow}
            disabled={!inStock || isAdding || isBuyingNow}
            className="flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {isBuyingNow ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isBuyingNow ? "Please wait..." : "Buy Now"}
          </button>
        </div>

        {product.description && (
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted">{product.description}</p>
          </div>
        )}
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-2">
        <button
          onClick={handleAddToCart}
          disabled={!inStock || isAdding || isBuyingNow}
          className="flex-1 bg-primary text-white py-3 rounded-xl font-medium disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
        >
          {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
          {isAdding ? "Adding..." : "Add to Cart"}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={!inStock || isAdding || isBuyingNow}
          className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
        >
          {isBuyingNow ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isBuyingNow ? "..." : "Buy Now"}
        </button>
      </div>
    </>
  )
}
