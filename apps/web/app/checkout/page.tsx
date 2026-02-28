"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import CheckoutStepper from "../../components/checkout/CheckoutStepper"
import CheckoutSummary from "../../components/checkout/CheckoutSummary"
import Link from "next/link"
import { toast } from "sonner"

export default function CheckoutPage() {
  const user = useAuthStore((s) => s.user)
  const items = useCartStore((s) => s.items)

  const [isLocking, setIsLocking] = useState(true)
  const [isValid, setIsValid] = useState(false)

  // ✅ NEW
  const [addressId, setAddressId] = useState<string>("")

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

  /* ---------------- EMPTY CART ---------------- */

  if (!items.length) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <Link href="/products" className="text-primary font-medium">
          Continue Shopping
        </Link>
      </div>
    )
  }

  /* ---------------- AUTH GUARD ---------------- */

  if (!user) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">Please login to continue</h2>
        <Link href="/signin" className="text-primary font-medium">
          Go to Sign In
        </Link>
      </div>
    )
  }

  /* ---------------- LOADING LOCK ---------------- */

  if (isLocking) {
    return (
      <div className="py-24 text-center text-muted">
        Locking latest pricing…
      </div>
    )
  }

  /* ---------------- PAGE ---------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <CheckoutStepper onAddressChange={setAddressId} />
      </div>

      <CheckoutSummary
        isValid={isValid}
        addressId={addressId}
      />
    </div>
  )
}
