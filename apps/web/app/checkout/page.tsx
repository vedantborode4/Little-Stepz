"use client"

import { useEffect, useRef, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useAddressStore } from "../../store/useAddressStore"
import CheckoutStepper from "../../components/checkout/CheckoutStepper"
import CheckoutSummary from "../../components/checkout/CheckoutSummary"
import GuestCheckoutGate from "../../components/checkout/GuestCheckoutGate"
import { useGuestSessionActive, useGuestSessionStore } from "../../store/useGuestSessionStore"
import DynamicPromoBanner from "../../components/home/DynamicPromoBanner"
import Link from "next/link"
import { toast } from "sonner"
import { ShoppingBag, Loader2, UserRound } from "lucide-react"
import { trackBeginCheckout } from "../../lib/analytics/ecommerce"

export default function CheckoutPage() {
  const user = useAuthStore((s) => s.user)
  const guestActive = useGuestSessionActive()
  const guestContact = useGuestSessionStore((s) => s.contact)
  const clearGuest = useGuestSessionStore((s) => s.clear)
  const items = useCartStore((s) => s.items)
  const storeAddressId = useAddressStore((s) => s.selectedAddressId)

  const [isLocking, setIsLocking] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(1)

  useEffect(() => {
    const lockPricing = async () => {
      try {
        setIsLocking(true)
        await useCartStore.getState().fetchCart()
        await useCartStore.getState().revalidateCoupon()
        setIsValid(true)
      } catch {
        toast.error("Cart updated. Please review before checkout.")
        setIsValid(false)
      } finally {
        setIsLocking(false)
      }
    }
    lockPricing()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // GA4: begin_checkout, once per checkout view when the cart is loaded (plan W7).
  const beganCheckout = useRef(false)
  useEffect(() => {
    if (!isLocking && items.length && !beganCheckout.current) {
      beganCheckout.current = true
      const st = useCartStore.getState()
      trackBeginCheckout(items, st.total, st.couponCode)
    }
  }, [isLocking, items])

  if (!items.length && !isLocking) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center gap-5">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ShoppingBag size={28} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-bold text-text">Your cart is empty</h2>
          <p className="text-sm text-faint mt-1.5">Add some products before checking out.</p>
        </div>
        <Link href="/products" className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm">
          Continue Shopping
        </Link>
      </div>
    )
  }

  if (isLocking) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-faint">Locking latest pricing…</p>
      </div>
    )
  }

  const isGuest = !user
  const resolvedAddressId = storeAddressId ?? ""
  const canPlaceOrder = isValid && !!resolvedAddressId && checkoutStep >= 3

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
      <DynamicPromoBanner position="CHECKOUT_TOP" className="mb-5 sm:mb-8" />

      {/* Page header */}
      <div className="mb-5 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-medium text-text">Checkout</h1>
        <p className="text-xs sm:text-sm text-faint mt-0.5">Complete your purchase securely</p>
      </div>

      {/* Mobile: stack vertically — summary below stepper */}
      <div className="grid lg:grid-cols-3 gap-5 sm:gap-8">
        <div className="lg:col-span-2">
          {isGuest && !guestActive ? (
            /* Not signed in: sign in, or continue as a guest (details + SMS code). */
            <GuestCheckoutGate />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {isGuest && guestContact && (
                <div className="bg-surface border border-border rounded-2xl px-4 py-3 shadow-card flex items-center gap-3">
                  <UserRound size={18} className="text-primary shrink-0" />
                  <p className="text-sm text-muted flex-1 min-w-0 truncate">
                    Checking out as guest: <span className="text-text font-medium">{guestContact.name}</span> · {guestContact.email}
                  </p>
                  <button onClick={clearGuest} className="text-xs font-semibold text-primary shrink-0">
                    Not you?
                  </button>
                </div>
              )}
              <CheckoutStepper onStepChange={setCheckoutStep} />
            </div>
          )}
        </div>
        {/* Summary — shows below on mobile, sticky on desktop */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <CheckoutSummary isValid={canPlaceOrder} addressId={resolvedAddressId} />
        </div>
      </div>
    </div>
  )
}
