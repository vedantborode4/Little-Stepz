"use client"

import { useEffect, useState } from "react"
import { useCartStore } from "../store/useCartStore"
import { toast } from "sonner"

export const useCheckout = () => {
  const {
    items,
    subtotal,
    total,
    couponCode,
    fetchCart,
    revalidateCoupon,
  } = useCartStore()

  const [isLocking, setIsLocking] = useState(true)
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    const lockPricing = async () => {
      try {
        setIsLocking(true)

        // 🧠 1. Get fresh cart from server
        await fetchCart()

        // 🧠 2. Revalidate coupon on fresh subtotal
        await revalidateCoupon()

        setIsValid(true)
      } catch {
        toast.error("Cart changed. Please review before checkout.")
        setIsValid(false)
      } finally {
        setIsLocking(false)
      }
    }

    lockPricing()
  }, [])

  return {
    items,
    subtotal,
    total,
    couponCode,
    isLocking,
    isValid,
  }
}
