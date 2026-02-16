"use client"

import { useCartStore } from "../../store/useCartStore"

export default function CheckoutSummary({
  isValid = true,
}: {
  isValid?: boolean
}) {
  const { subtotal, total, discount, couponCode } = useCartStore()

  return (
    <div className="bg-white border rounded-xl p-6 h-fit sticky top-24 space-y-4">

      <h2 className="text-lg font-semibold">Price Details</h2>

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>₹{subtotal}</span>
      </div>

      {couponCode && (
        <div className="flex justify-between text-sm text-primary">
          <span>Coupon ({couponCode})</span>
          <span>-₹{discount}</span>
        </div>
      )}

      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span className="text-green-600">Free</span>
      </div>

      <div className="border-t pt-3 flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span className="text-primary">₹{total}</span>
      </div>

      <button
        disabled={!isValid}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-50"
      >
        Place Order
      </button>

      {!isValid && (
        <p className="text-xs text-red-500 text-center">
          Cart updated. Please review before placing order.
        </p>
      )}
    </div>
  )
}
