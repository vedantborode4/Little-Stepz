"use client"

import { useState, useMemo } from "react"
import { Product } from "../../../types/product"
import { Heart, Loader2, Zap, ShoppingCart, Star, Shield, Truck } from "lucide-react"
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
      await addItem({ productId: product.id, variantId: selectedVariant?.id, quantity })
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
      await addItem({ productId: product.id, variantId: selectedVariant?.id, quantity })
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
      <div className="space-y-5 pb-24 lg:pb-0">
        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div>
            {product.category && (
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wide">
                {product.category.name}
              </span>
            )}
            <h1 className="text-2xl font-bold text-gray-900 mt-2 leading-tight">{product.name}</h1>
          </div>
          <button
            onClick={handleWishlist}
            className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border transition-all ${
              isInWishlist
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5"
            }`}
          >
            <Heart className={`w-5 h-5 ${isInWishlist ? "fill-primary" : ""}`} />
          </button>
        </div>

        {/* Price + Stock */}
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold text-gray-900">
            ₹{Number(displayPrice).toLocaleString("en-IN")}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            inStock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
          }`}>
            {inStock ? "● In Stock" : "● Out of Stock"}
          </span>
        </div>

        {/* Rating placeholder */}
        <div className="flex items-center gap-1.5">
          {[1,2,3,4,5].map((i) => (
            <Star key={i} size={14} className={i <= 4 ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"} />
          ))}
          <span className="text-xs text-gray-400 ml-1">4.0 · Customer Reviews</span>
        </div>

        {/* Variants */}
        {product.variants?.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-gray-700">Select Variant</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const active = selectedVariant?.id === variant.id
                return (
                  <button
                    key={variant.id}
                    disabled={isAdding || isBuyingNow}
                    onClick={() => setSelectedVariant(variant)}
                    className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {variant.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">Quantity</span>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
              disabled={isAdding || isBuyingNow || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-4 py-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition font-medium"
            >
              −
            </button>
            <span className="px-5 py-2.5 text-sm font-semibold text-gray-900 border-x border-gray-200 min-w-[50px] text-center">
              {quantity}
            </span>
            <button
              disabled={isAdding || isBuyingNow || quantity >= maxStock}
              onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
              className="px-4 py-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* CTA buttons — desktop */}
        <div className="hidden lg:flex gap-3 pt-1">
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding || isBuyingNow}
            className="flex-1 border-2 border-primary text-primary py-3.5 rounded-xl font-semibold hover:bg-primary/5 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart size={17} />}
            {isAdding ? "Adding…" : "Add to Cart"}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!inStock || isAdding || isBuyingNow}
            className="flex-1 bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {isBuyingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={17} />}
            {isBuyingNow ? "Please wait…" : "Buy Now"}
          </button>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3">
            <Truck size={16} className="text-secondary flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-800">Free Delivery</p>
              <p className="text-[10px] text-gray-400">On all orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3">
            <Shield size={16} className="text-secondary flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-800">Easy Returns</p>
              <p className="text-[10px] text-gray-400">7-day return policy</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2.5">About this product</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 flex gap-2.5 z-30 shadow-lg">
        <button
          onClick={handleAddToCart}
          disabled={!inStock || isAdding || isBuyingNow}
          className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm"
        >
          {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
          {isAdding ? "Adding…" : "Add to Cart"}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!inStock || isAdding || isBuyingNow}
          className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm shadow-sm"
        >
          {isBuyingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={15} />}
          {isBuyingNow ? "…" : "Buy Now"}
        </button>
      </div>
    </>
  )
}
