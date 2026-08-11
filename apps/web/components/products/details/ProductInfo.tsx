"use client"

import { useState, useMemo, useEffect } from "react"
import { Product, Variant } from "../../../types/product"
import { getDisplayPrices } from "../../../lib/pricing"
import PriceTag from "../PriceTag"
import ProductShare from "../ProductShare"
import { RICH_TEXT_CLASS } from "../../../lib/richText"
import { Heart, Loader2, Zap, ShoppingCart, Star, Shield, Truck, Clock, ShieldCheck, Info } from "lucide-react"
import { useCartStore } from "../../../store/useCartStore"
import { useWishlistStore } from "../../../store/useWishlistStore"
import { useReviewStore } from "../../../store/useReviewStore"
import OptionSelector from "./OptionSelector"
import DeliveryCheck from "./DeliveryCheck"
import { findVariant, type Selection } from "../../../lib/variants/matrix"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { friendlyError } from "../../../lib/errorMessages"

export default function ProductInfo({
  product,
  selectedVariant: controlledVariant,
  onSelectVariant,
}: {
  product: Product
  selectedVariant?: Variant | null
  onSelectVariant?: (v: Variant | null) => void
}) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggle)
  const router = useRouter()

  const isInWishlist = useWishlistStore((s) => s.isInWishlist(product.id))
  const reviewStats = useReviewStore((s) => s.stats)

  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)

  // Default to no variant → the base product is shown. Variants are optional.
  const [internalVariant, setInternalVariant] = useState<Variant | null>(null)
  // Controlled by the page (so the gallery can react) with a local fallback.
  const selectedVariant = controlledVariant !== undefined ? controlledVariant : internalVariant
  const setSelectedVariant = (v: Variant | null) => {
    setInternalVariant(v)
    onSelectVariant?.(v)
  }
  // Clicking the active variant again clears it, returning to the base product.
  const toggleVariant = (v: Variant) =>
    setSelectedVariant(selectedVariant?.id === v.id ? null : v)

  // Structured (Size/Color) products drive the selection through option axes; the
  // resolved variant is derived from the picked values.
  const hasOptions = (product.options?.length ?? 0) > 0
  const [selection, setSelection] = useState<Selection>({})
  const handleOptionSelect = (optionId: string, valueId: string) =>
    setSelection((prev) => {
      const next = { ...prev }
      if (next[optionId] === valueId) delete next[optionId]
      else next[optionId] = valueId
      return next
    })
  useEffect(() => {
    if (!hasOptions) return
    setSelectedVariant(findVariant(product, selection))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  // Sanitize the rich-text long description on the client only (avoids jsdom/SSR).
  const [safeLongDesc, setSafeLongDesc] = useState("")
  useEffect(() => {
    const html = product.longDescription
    if (!html) { setSafeLongDesc(""); return }
    let active = true
    import("dompurify").then(({ default: DOMPurify }) => {
      if (active) setSafeLongDesc(DOMPurify.sanitize(html))
    })
    return () => { active = false }
  }, [product.longDescription])

  const displayPrices = useMemo(
    () => getDisplayPrices(product, selectedVariant),
    [product, selectedVariant]
  )

  const inStock = useMemo(() => {
    if (!selectedVariant) return product.inStock
    return selectedVariant.stock > 0
  }, [selectedVariant, product.inStock])

  const maxStock = useMemo(() => {
    if (!selectedVariant) return product.quantity ?? 10
    return selectedVariant.stock
  }, [selectedVariant, product.quantity])

  const canPreOrder = !inStock && !!product.preOrderEnabled && product.bookingAmount != null

  // The base product stays purchasable on its own stock even when variants exist, so
  // "add to cart" with nothing picked is a real purchase — it was just invisible.
  // Say which one is going in the cart rather than leaving the customer to guess.
  const hasVariantChoices = hasOptions || (product.variants?.length ?? 0) > 0
  const optionAxisLabel = hasOptions
    ? (product.options ?? []).map((o) => o.name).join(" and ")
    : "a variant"

  // A pre-order product is out of stock by definition, so capping the stepper at
  // available stock pinned it to `quantity >= 0` and disabled BOTH buttons — the
  // quantity control was dead on every pre-order product. Pre-orders are bounded
  // by the pre-order limit, not by stock.
  const maxQty = useMemo(() => {
    if (!canPreOrder) return maxStock
    if (product.preOrderLimit == null) return 99
    return Math.max(1, product.preOrderLimit - (product.preOrderCount ?? 0))
  }, [canPreOrder, maxStock, product.preOrderLimit, product.preOrderCount])

  // Carried to the booking page so the chosen quantity survives the hop.
  const preOrderHref = `/pre-order/${product.slug}?qty=${quantity}${
    selectedVariant ? `&variant=${selectedVariant.id}` : ""
  }`

  const handleAddToCart = async () => {
    if (isAdding) return
    try {
      setIsAdding(true)
      await addItem({ productId: product.id, variantId: selectedVariant?.id, quantity })
      toast.success("Added to cart")
    } catch (err: any) {
      toast.error(friendlyError(err, "Failed to add to cart"))
    } finally {
      setIsAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (isBuyingNow) return
    try {
      setIsBuyingNow(true)
      await addItem({ productId: product.id, variantId: selectedVariant?.id, quantity })
      router.push("/checkout")
    } catch (err: any) {
      toast.error(friendlyError(err, "Failed to proceed to checkout"))
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
        <div>
          <div className="flex items-center gap-4">
            {product.category && (
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wide">
                {product.category.name}
              </span>
            )}
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              <button
                onClick={handleWishlist}
                className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all ${
                  isInWishlist
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-faint hover:border-primary hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Heart className={`w-5 h-5 ${isInWishlist ? "fill-primary" : ""}`} />
              </button>
              <ProductShare
                slug={product.slug}
                name={product.name}
                className="flex items-center gap-2"
                buttonClassName="w-11 h-11 flex items-center justify-center rounded-xl border border-border text-faint hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                iconSize={18}
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mt-2 leading-tight">{product.name}</h1>
        </div>

        {/* Price + Stock */}
        <div className="flex items-center gap-4">
          <PriceTag prices={displayPrices} size="lg" />
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            inStock ? "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" : canPreOrder ? "bg-primary/10 text-primary" : "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400"
          }`}>
            {inStock ? "● In Stock" : canPreOrder ? "● Pre-Order" : "● Out of Stock"}
          </span>
        </div>

        {/* Pre-order banner */}
        {canPreOrder && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 flex items-start gap-2.5">
            <Clock size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary">
                Pre-order now · Pay ₹{Number(product.bookingAmount).toLocaleString("en-IN")} booking
              </p>
              <p className="text-primary/70 text-xs mt-0.5">
                Pay the balance via a secure link when it's back in stock.
                {product.preOrderNote ? ` ${product.preOrderNote}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Rating — from real reviews; hidden when the product has none */}
        {reviewStats && reviewStats.total > 0 && (
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={14} className={i <= Math.round(reviewStats.average) ? "fill-amber-400 text-amber-400" : "text-faint fill-surface-3"} />
            ))}
            <span className="text-xs text-faint ml-1">
              {reviewStats.average.toFixed(1)} · {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Structured options (Size / Color) — resolve to a variant */}
        {hasOptions && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-end">
              {Object.keys(selection).length > 0 && (
                <button
                  onClick={() => setSelection({})}
                  className="text-xs font-medium text-primary hover:opacity-80"
                >
                  Clear · show base
                </button>
              )}
            </div>
            <OptionSelector
              product={product}
              selection={selection}
              onSelect={handleOptionSelect}
              disabled={isAdding || isBuyingNow}
            />
          </div>
        )}

        {/* Legacy flat variants — optional; tap to select, tap again to clear */}
        {!hasOptions && product.variants?.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">Select Variant</p>
              {selectedVariant && (
                <button
                  onClick={() => setSelectedVariant(null)}
                  className="text-xs font-medium text-primary hover:opacity-80"
                >
                  Clear · show base
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const active = selectedVariant?.id === variant.id
                const out = variant.stock <= 0
                return (
                  <button
                    key={variant.id}
                    disabled={out || isAdding || isBuyingNow}
                    onClick={() => toggleVariant(variant)}
                    className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
                      out
                        ? "border-border text-faint line-through cursor-not-allowed"
                        : active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted hover:border-primary hover:text-primary"
                    }`}
                  >
                    {variant.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* What's actually going in the cart — the base product is a real, buyable
            SKU, so leaving the selection empty must not look like nothing happened. */}
        {hasVariantChoices && !canPreOrder && (
          <div className={`flex items-start gap-2.5 rounded-xl p-3.5 border ${
            selectedVariant
              ? "bg-primary/5 border-primary/15"
              : "bg-surface-2 border-border"
          }`}>
            <Info size={16} className={`flex-shrink-0 mt-0.5 ${selectedVariant ? "text-primary" : "text-faint"}`} />
            <p className="text-xs text-muted">
              {selectedVariant ? (
                <>
                  <span className="font-semibold text-text">{selectedVariant.name}</span> selected.
                </>
              ) : (
                <>
                  <span className="font-semibold text-text">Standard version</span> — pick {optionAxisLabel} above
                  to choose a specific one.
                </>
              )}
            </p>
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-muted">Quantity</span>
          <div className="flex items-center border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
            <button
              disabled={isAdding || isBuyingNow || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-4 py-2.5 text-muted hover:bg-surface-2 disabled:opacity-40 transition font-medium"
            >
              −
            </button>
            <span className="px-5 py-2.5 text-sm font-semibold text-text border-x border-border min-w-[50px] text-center">
              {quantity}
            </span>
            <button
              disabled={isAdding || isBuyingNow || quantity >= maxQty}
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="px-4 py-2.5 text-muted hover:bg-surface-2 disabled:opacity-40 transition font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* CTA buttons — desktop */}
        <div className="hidden lg:flex gap-3 pt-1">
          {canPreOrder ? (
            <Link
              href={preOrderHref}
              className="flex-1 bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Clock size={17} />
              Pre-Order · ₹{Number(product.bookingAmount).toLocaleString("en-IN")}
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-xl px-3.5 py-3">
            <Truck size={16} className="text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-text">Free Delivery</p>
              <p className="text-[10px] text-faint">On all orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-xl px-3.5 py-3">
            <Shield size={16} className="text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-text">Easy Returns</p>
              <p className="text-[10px] text-faint">7-day return policy</p>
            </div>
          </div>
        </div>

        {/* Delivery availability check */}
        <DeliveryCheck />

        {/* Authenticity / unboxing note */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} className="text-primary flex-shrink-0" />
          <span>
            Unboxing video required for damage claims —{" "}
            <Link href="/unboxing-policy" className="text-primary font-medium hover:underline">
              Read our policy
            </Link>
          </span>
        </div>

        {/* Description */}
        {product.description && (
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text mb-2.5">About this product</h3>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>
        )}

        {/* Specifications */}
        {Array.isArray(product.specifications) && product.specifications.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text mb-3">Specifications</h3>
            <table className="w-full table-fixed text-sm">
              <tbody>
                {product.specifications.map((spec, i) => (
                  <tr key={i} className="border-b border-border last:border-0 align-top">
                    <td className="py-2.5 pr-3 sm:pr-4 text-muted font-medium wrap-break-word w-2/5 sm:w-1/3">{spec.label}</td>
                    <td className="py-2.5 text-text wrap-break-word">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Long description (rich text) */}
        {safeLongDesc && (
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text mb-2.5">Product Details</h3>
            <div
              className={`text-sm text-muted ${RICH_TEXT_CLASS}`}
              dangerouslySetInnerHTML={{ __html: safeLongDesc }}
            />
          </div>
        )}
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-3 flex gap-2.5 z-30 shadow-lg">
        {canPreOrder ? (
          <Link
            href={preOrderHref}
            className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-sm"
          >
            <Clock size={15} />
            Pre-Order · ₹{Number(product.bookingAmount).toLocaleString("en-IN")}
          </Link>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )
}
