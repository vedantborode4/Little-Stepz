"use client"

import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useCheckoutStore } from "../../store/useCheckoutStore"
import { useAddressStore } from "../../store/useAddressStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import CouponBox from "../cart/CouponBox"
import { CheckoutService } from "../../lib/services/checkout.service"
import { ShoppingBag, Loader2, Tag, Truck, CreditCard } from "lucide-react"

export default function CheckoutSummary({
  isValid = true,
  addressId,
}: {
  isValid?: boolean
  addressId?: string
}) {
  const router = useRouter()

  const user = useAuthStore((s) => s.user)
  const isGuest = !user

  const { subtotal, total, discount, couponCode, items } = useCartStore()
  const { placeOrder, placingOrder, paymentPlan, setQuote } = useCheckoutStore()
  const forfeitureAck = useCheckoutStore((s) => s.forfeitureAck)

  const storeAddressId = useAddressStore((s) => s.selectedAddressId)
  const resolvedAddressId = addressId || storeAddressId || ""

  // Server-authoritative totals. This summary used to compute the total client-side
  // and hardcode "Shipping: Free", so it agreed with the amount actually charged
  // only for as long as shipping happened to be free. Mobile already asks the
  // backend; web now does the same, and falls back to the local figures if the
  // call fails so the page never blocks on it.
  const quote = useCheckoutStore((s) => s.quote)

  useEffect(() => {
    if (isGuest || !resolvedAddressId || !items.length) {
      setQuote(null)
      return
    }
    let cancelled = false
    CheckoutService.calculate(
      items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity: i.quantity,
      })),
      resolvedAddressId,
      couponCode || null
    )
      .then((res) => { if (!cancelled) setQuote(res) })
      .catch(() => { if (!cancelled) setQuote(null) })
    return () => { cancelled = true }
  }, [isGuest, resolvedAddressId, items, couponCode, setQuote])

  const shownSubtotal = quote?.subtotal ?? subtotal
  const shownDiscount = quote?.discount ?? discount
  const shownShipping = quote?.shippingCharges ?? 0
  const shownTotal    = quote?.total ?? total

  const handleOrder = async () => {
    // Guests browse checkout freely; we only require an account at the moment
    // of placing the order, then send them straight back here.
    if (isGuest) {
      router.push(`/signin?redirect=${encodeURIComponent("/checkout")}`)
      return
    }
    if (!isValid || !resolvedAddressId || placingOrder) return
    const orderId = await placeOrder(resolvedAddressId)
    if (orderId) router.push(`/order-success/${orderId}`)
  }

  const partial = quote?.partialPayment ?? null
  // Only true when the server actually offered the plan — the store resets to FULL the
  // moment a new quote says otherwise.
  const isPartial = paymentPlan === "PARTIAL" && Boolean(partial?.eligible)

  // The acknowledgement gates the button rather than being validated on submit: a
  // customer should not be able to start a payment they have not agreed the terms of.
  const canPlace =
    isGuest || (isValid && !placingOrder && (!isPartial || forfeitureAck))

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-card p-6 space-y-5 h-fit sticky top-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-primary/10 rounded-xl">
          <ShoppingBag size={15} className="text-primary" />
        </div>
        <h2 className="text-base font-semibold text-text">Order Summary</h2>
      </div>

      {/* Coupon */}
      <CouponBox />

      {/* Breakdown */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="font-medium text-text">₹{shownSubtotal?.toLocaleString("en-IN")}</span>
        </div>

        {couponCode && (
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Tag size={12} />
              Coupon ({couponCode})
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">−₹{shownDiscount?.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <Truck size={13} />
            Shipping
          </span>
          {shownShipping > 0 ? (
            <span className="font-medium text-text">₹{shownShipping.toLocaleString("en-IN")}</span>
          ) : (
            <span className="font-medium text-green-600 dark:text-green-400">Free</span>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-border pt-4 flex justify-between items-center">
        <span className="font-semibold text-text">Total</span>
        <span className="text-xl font-bold text-primary">₹{shownTotal?.toLocaleString("en-IN")}</span>
      </div>

      {/* What is actually being charged now, versus what the courier collects. */}
      {isPartial && partial ? (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-primary">
              Pay now ({partial.depositPercent}% deposit)
            </span>
            <span className="text-sm font-bold text-primary">
              ₹{partial.depositAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">Balance at delivery</span>
            <span className="text-sm text-muted">
              ₹{partial.balanceAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      ) : null}

      {/* Payment method badge */}
      <div className="bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <CreditCard size={13} />
          Payment
        </span>
        <span className="text-xs font-semibold text-muted">
          {isPartial ? "20% now · rest on delivery" : "Online (Razorpay)"}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={handleOrder}
        disabled={!canPlace}
        className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
      >
        {placingOrder ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing payment…
          </>
        ) : isGuest ? (
          "Place Order"
        ) : isPartial && partial ? (
          `Pay ₹${partial.depositAmount.toLocaleString("en-IN")} & Place Order`
        ) : (
          "Proceed to Pay"
        )}
      </button>

      {isGuest && (
        <p className="text-xs text-muted text-center">
          You'll be asked to sign in before your order is placed.
        </p>
      )}

      {!isGuest && !resolvedAddressId && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 rounded-lg py-2 px-3">
          Please select a delivery address to continue.
        </p>
      )}

      {!isGuest && isPartial && !forfeitureAck && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 rounded-lg py-2 px-3">
          Please confirm the deposit terms above to continue.
        </p>
      )}

      {!isGuest && !isValid && (
        <p className="text-xs text-red-500 dark:text-red-400 text-center bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/20 rounded-lg py-2 px-3">
          Cart updated. Please review before placing order.
        </p>
      )}

      <p className="text-[11px] text-center text-faint">
        🔒 Secure & encrypted checkout
      </p>
    </div>
  )
}