"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, Loader2, MapPin } from "lucide-react"
import { ProductService } from "../../../lib/services/product.service"
import { PreOrderService } from "../../../lib/services/preorder.service"
import CheckoutAddressSection from "../../../components/address/CheckoutAddressSection"
import { useAddressStore } from "../../../store/useAddressStore"
import { getChargedPrice } from "../../../lib/pricing"
import { cldFill } from "../../../lib/utils/cloudinaryUrl"
import { openRazorpay } from "../../../lib/openRazorpay"
import type { Product } from "../../../types/product"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`
const SHIPPING = 5

export default function PreOrderCheckoutPage() {
  const params = useParams<{ slug: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const variantId = search?.get("variant") || undefined

  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const addressId = useAddressStore((s) => s.selectedAddressId) ?? ""
  // Stable per-attempt key so retries de-duplicate server-side.
  const idemKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    if (!params?.slug) return
    ;(async () => {
      try {
        const p = await ProductService.getBySlug(params.slug)
        setProduct(p)
      } catch {
        toast.error("Could not load pre-order")
      } finally {
        setLoading(false)
      }
    })()
  }, [params?.slug])

  const variant = useMemo(
    () => product?.variants?.find((v) => v.id === variantId) || null,
    [product, variantId]
  )

  const maxQty = product?.preOrderLimit
    ? Math.max(1, product.preOrderLimit - (product.preOrderCount ?? 0))
    : 99

  const unit = product ? getChargedPrice(product, variant) : 0
  const booking = product?.bookingAmount != null ? Number(product.bookingAmount) : 0
  const total = unit * quantity + SHIPPING
  const balance = Math.max(0, total - booking)

  const confirm = async () => {
    if (!product) return
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
      toast.error(e?.response?.data?.message || "Pre-order failed")
      setPlacing(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-faint">Loading…</div>
  }
  if (!product || !product.preOrderEnabled) {
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
        <div className="flex items-center border border-border rounded-xl overflow-hidden h-9">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 text-muted">−</button>
          <span className="px-3 text-sm font-semibold">{quantity}</span>
          <button onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} className="px-3 text-muted">+</button>
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
        <div className="flex justify-between text-muted"><span>Shipping</span><span>{inr(SHIPPING)}</span></div>
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
        You'll receive a secure link to pay the remaining {inr(balance)} when the item is back in stock.
      </p>
    </div>
  )
}
