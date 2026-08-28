"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, Loader2, MapPin, Info } from "lucide-react"
import { PreOrderService } from "../../lib/services/preorder.service"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import { useAddressStore } from "../../store/useAddressStore"
import { getChargedPrice } from "../../lib/pricing"
import OptionSelector from "../products/details/OptionSelector"
import { findVariant, type Selection } from "../../lib/variants/matrix"
import type { Variant } from "../../types/product"
import { cldFill } from "../../lib/utils/cloudinaryUrl"
import { openRazorpay } from "../../lib/openRazorpay"
import type { Product } from "../../types/product"
import { friendlyError } from "../../lib/errorMessages"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`
// Mirrors the backend's customer shipping charge (FREE_SHIPPING) — delivery is on us.
const SHIPPING = 0

/**
 * Interactive pre-order checkout island (plan W1).
 *
 * The product is fetched on the server (see the route's page.tsx) and passed in,
 * so the product summary renders into the initial HTML. Address selection and
 * the Razorpay booking flow run on the client after hydration.
 */
export default function PreOrderCheckoutView({ product }: { product: Product }) {
  const search = useSearchParams()
  const router = useRouter()
  const variantId = search?.get("variant") || undefined

  // Seeded from the PDP stepper (?qty=) so the chosen quantity survives the hop;
  // clamped below once the limit is known.
  const [quantity, setQuantity] = useState(() => {
    const raw = Number(search?.get("qty"))
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
  })
  const [placing, setPlacing] = useState(false)
  const addressId = useAddressStore((s) => s.selectedAddressId) ?? ""
  // Stable per-attempt key so retries de-duplicate server-side.
  const idemKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  const hasOptions = (product.options?.length ?? 0) > 0
  // Memoised so the fallback [] is not a fresh array on every render, which would
  // re-run the variant lookup below each time.
  const variants = useMemo(() => product.variants ?? [], [product.variants])

  // The ?variant= from the PDP is a hint, not a contract: the link may be old, may
  // have been shared, or may name a variant that has since been deleted. Resolve it
  // against the product actually loaded and fall back to the base product.
  const initialVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
  )
  const [variant, setVariant] = useState<Variant | null>(initialVariant)

  // Seed the option axes from that variant so the picker opens on the customer's
  // PDP choice rather than blank.
  const [selection, setSelection] = useState<Selection>(() => {
    const seed: Selection = {}
    if (!initialVariant) return seed
    // A variant only stores optionValueIds, so the owning axis is looked up from
    // the product's option list.
    const picked = new Set(initialVariant.optionValues?.map((o) => o.optionValueId) ?? [])
    for (const opt of product.options ?? []) {
      const match = opt.values.find((v) => picked.has(v.id))
      if (match) seed[opt.id] = match.id
    }
    return seed
  })

  const handleOptionSelect = (optionId: string, valueId: string) =>
    setSelection((prev) => {
      const next = { ...prev }
      if (next[optionId] === valueId) delete next[optionId]
      else next[optionId] = valueId
      return next
    })

  useEffect(() => {
    if (!hasOptions) return
    setVariant(findVariant(product, selection))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  // A link naming a variant this product does not have would otherwise book the base
  // product silently at a different price. Say so instead.
  const staleVariantLink = !!variantId && !initialVariant

  const maxQty = product.preOrderLimit
    ? Math.max(1, product.preOrderLimit - (product.preOrderCount ?? 0))
    : 99

  // A ?qty= above the remaining limit must not survive into the booking request —
  // the server rejects it and the summary would have quoted the wrong total.
  const qty = Math.min(quantity, maxQty)
  if (qty !== quantity) setQuantity(qty)

  const unit = getChargedPrice(product, variant)
  const booking = product.bookingAmount != null ? Number(product.bookingAmount) : 0
  const total = unit * quantity + SHIPPING
  const balance = Math.max(0, total - booking)

  const confirm = async () => {
    if (!addressId) { toast.error("Select a delivery address"); return }
    setPlacing(true)
    try {
      const init = await PreOrderService.create({
        productId: product.id,
        variantId: variant?.id,
        quantity,
        addressId,
      }, idemKey.current)
      const result = await openRazorpay({
        keyId: init.keyId,
        amount: init.amount,
        currency: init.currency,
        razorpayOrderId: init.razorpayOrderId,
        description: `Pre-order booking — ${product.name}`,
      })
      if (!result) { setPlacing(false); return }
      await PreOrderService.verifyBooking(init.preOrderId, result)
      toast.success("Pre-order confirmed 🎉")
      router.push("/account/pre-orders")
    } catch (e: any) {
      toast.error(friendlyError(e, "Pre-order failed"))
      setPlacing(false)
    }
  }

  if (!product.preOrderEnabled) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted">Pre-order not available for this product.</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-primary">
        <Clock size={18} />
        <h1 className="text-xl font-bold">Pre-Order</h1>
      </div>

      {/* Product */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex gap-4">
        <img
          src={cldFill(variant?.images?.[0]?.url || product.images?.[0]?.url || "/placeholder.png", 200)}
          alt={product.name}
          className="w-20 h-20 object-cover rounded-xl border border-border"
        />
        <div className="flex-1">
          <p className="font-semibold text-text">{product.name}</p>
          {variant && <p className="text-xs text-faint mt-0.5">{variant.name}</p>}
          <p className="text-sm text-muted mt-1">{inr(unit)} each</p>
          {product.preOrderNote && <p className="text-xs text-primary mt-1">{product.preOrderNote}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center border border-border rounded-xl overflow-hidden h-9">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={placing || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 text-muted disabled:opacity-40 transition"
            >
              −
            </button>
            <span className="px-3 text-sm font-semibold">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={placing || quantity >= maxQty}
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="px-3 text-muted disabled:opacity-40 transition"
            >
              +
            </button>
          </div>
          {/* Say why the stepper stopped, rather than silently ignoring the tap. */}
          {product.preOrderLimit != null && quantity >= maxQty && (
            <span className="text-[10px] text-faint">Max {maxQty} per order</span>
          )}
        </div>
      </div>

      {/* Variant picker — the PDP passes ?variant=, but this page is also reachable
          directly, and a booking must be able to name a specific variant. Stock is
          ignored throughout: a pre-order product has none by definition. */}
      {(hasOptions || variants.length > 0) && (
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          {hasOptions ? (
            <OptionSelector
              product={product}
              selection={selection}
              onSelect={handleOptionSelect}
              disabled={placing}
              ignoreStock
            />
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted">Select Variant</p>
                {variant && (
                  <button
                    type="button"
                    onClick={() => setVariant(null)}
                    className="text-xs font-medium text-primary hover:opacity-80"
                  >
                    Clear · show base
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = variant?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={placing}
                      onClick={() => setVariant(active ? null : v)}
                      className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border text-muted hover:border-primary hover:text-primary"
                      }`}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${
            variant ? "bg-primary/5 border-primary/15" : "bg-surface-2 border-border"
          }`}>
            <Info size={15} className={`shrink-0 mt-0.5 ${variant ? "text-primary" : "text-faint"}`} />
            <p className="text-xs text-muted">
              {staleVariantLink ? (
                <>That link pointed at a variant we no longer offer. Pick another below — otherwise the{" "}
                <span className="font-semibold text-text">standard version</span> is reserved.</>
              ) : variant ? (
                <><span className="font-semibold text-text">{variant.name}</span> will be reserved at {inr(unit)} each.</>
              ) : (
                <>The <span className="font-semibold text-text">standard version</span> will be reserved.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Address */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-text font-semibold text-sm">
          <MapPin size={16} /> Delivery address
        </div>
        <CheckoutAddressSection />
      </div>

      {/* Summary */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted"><span>Subtotal ({quantity})</span><span>{inr(unit * quantity)}</span></div>
        <div className="flex justify-between text-muted"><span>Shipping</span><span className={SHIPPING === 0 ? "font-medium text-green-600 dark:text-green-400" : undefined}>{SHIPPING === 0 ? "Free" : inr(SHIPPING)}</span></div>
        <div className="flex justify-between text-text font-semibold border-t border-border pt-2"><span>Order total</span><span>{inr(total)}</span></div>
        <div className="flex justify-between text-primary font-semibold"><span>Pay now (booking)</span><span>{inr(booking)}</span></div>
        <div className="flex justify-between text-muted"><span>Balance later</span><span>{inr(balance)}</span></div>
      </div>

      <button
        onClick={confirm}
        disabled={placing || !addressId}
        className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {placing && <Loader2 size={16} className="animate-spin" />}
        {placing ? "Processing…" : `Pay ₹${booking.toLocaleString("en-IN")} & Pre-Order`}
      </button>
      <p className="text-xs text-faint text-center">
        You&apos;ll receive a secure link to pay the remaining {inr(balance)} when the item is back in stock.
      </p>
    </div>
  )
}
