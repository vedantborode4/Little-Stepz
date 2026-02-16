"use client"

import { useCartStore } from "../../store/useCartStore"

export default function CheckoutSummary() {
  const subtotal = useCartStore((s) => s.subtotal)

  return (
    <div className="bg-white border rounded-xl p-6 h-fit sticky top-24 space-y-4">

      <h2 className="text-lg font-semibold">
        Price Details
      </h2>

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>₹{subtotal}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span className="text-green-600">Free</span>
      </div>

      <div className="border-t pt-3 flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span className="text-primary">₹{subtotal}</span>
      </div>

      <button className="w-full bg-primary text-white py-3 rounded-xl font-medium">
        Place Order
      </button>
    </div>
  )
}
