"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useAddressStore } from "../../store/useAddressStore"
import CheckoutStepper from "../../components/checkout/CheckoutStepper"
import CheckoutSummary from "../../components/checkout/CheckoutSummary"
import DynamicPromoBanner from "../../components/home/DynamicPromoBanner"
import Link from "next/link"
import { toast } from "sonner"
import { ShoppingBag, LogIn, Loader2 } from "lucide-react"

export default function CheckoutPage() {
  const user = useAuthStore((s) => s.user)
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
          {isGuest ? (
            /* Guests can review their order here, but a delivery address belongs
               to an account — so we ask them to sign in before that step. */
            <div className="bg-surface border border-border rounded-2xl shadow-card p-6 sm:p-8 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <LogIn size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text">Sign in to add a delivery address</h2>
                <p className="text-sm text-muted mt-1.5 max-w-sm">
                  Your cart is saved. Sign in to choose where we should ship your order and to complete payment.
                </p>
              </div>
              <Link
                href={`/signin?redirect=${encodeURIComponent("/checkout")}`}
                className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
              >
                Sign In to Continue
              </Link>
              <p className="text-xs text-faint">
                New here?{" "}
                <Link href={`/signup?redirect=${encodeURIComponent("/checkout")}`} className="text-primary font-semibold">
                  Create an account
                </Link>
              </p>
            </div>
          ) : (
            <CheckoutStepper onStepChange={setCheckoutStep} />
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
