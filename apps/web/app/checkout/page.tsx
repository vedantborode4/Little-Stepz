"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useAddressStore } from "../../store/useAddressStore"
import CheckoutStepper from "../../components/checkout/CheckoutStepper"
import CheckoutSummary from "../../components/checkout/CheckoutSummary"
import Link from "next/link"
import { toast } from "sonner"

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
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <Link href="/products" className="text-primary font-medium">Continue Shopping</Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">Please login to continue</h2>
        <Link href="/signin" className="text-primary font-medium">Go to Sign In</Link>
      </div>
    )
  }

  if (isLocking) {
    return <div className="py-24 text-center text-muted">Locking latest pricing…</div>
  }

  // addressId comes from the store (auto-populated from default address)
  const resolvedAddressId = storeAddressId ?? ""
  const canPlaceOrder = isValid && !!resolvedAddressId && checkoutStep >= 3

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <CheckoutStepper onStepChange={setCheckoutStep} />
      </div>
      <CheckoutSummary isValid={canPlaceOrder} addressId={resolvedAddressId} />
    </div>
  )
}
