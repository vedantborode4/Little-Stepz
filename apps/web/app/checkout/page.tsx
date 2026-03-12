"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useAddressStore } from "../../store/useAddressStore"
import CheckoutStepper from "../../components/checkout/CheckoutStepper"
import CheckoutSummary from "../../components/checkout/CheckoutSummary"
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
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-5">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ShoppingBag size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
          <p className="text-sm text-gray-400 mt-1.5">Add some products before checking out.</p>
        </div>
        <Link
          href="/products"
          className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-5">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <LogIn size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Sign in to continue</h2>
          <p className="text-sm text-gray-400 mt-1.5">Please log in to proceed with checkout.</p>
        </div>
        <Link
          href="/signin"
          className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          Go to Sign In
        </Link>
      </div>
    )
  }

  if (isLocking) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-gray-400">Locking latest pricing…</p>
      </div>
    )
  }

  const resolvedAddressId = storeAddressId ?? ""
  const canPlaceOrder = isValid && !!resolvedAddressId && checkoutStep >= 3

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        <p className="text-xs text-gray-400 mt-0.5">Complete your purchase securely</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CheckoutStepper onStepChange={setCheckoutStep} />
        </div>
        <CheckoutSummary isValid={canPlaceOrder} addressId={resolvedAddressId} />
      </div>
    </div>
  )
}
