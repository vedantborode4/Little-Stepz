"use client"

import { useMemo, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, Loader2, MapPin } from "lucide-react"
import { PreOrderService } from "../../lib/services/preorder.service"
import CheckoutAddressSection from "../address/CheckoutAddressSection"
import { useAddressStore } from "../../store/useAddressStore"
import { getChargedPrice } from "../../lib/pricing"
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

  const variant = useMemo(
    () => product.variants?.find((v) => v.id === variantId) || null,
    [product, variantId],
  )

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
