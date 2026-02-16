"use client"

import { useCartStore } from "../../store/useCartStore"
import Link from "next/link"
import CouponBox from "./CouponBox"

export default function CartSummary() {
  const { subtotal, total, discount, items } = useCartStore()

  const shipping = items.length > 0 ? 0 : 0

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 h-fit space-y-4">
      <h2 className="text-lg font-semibold">Order Summary</h2>

      <CouponBox />

      <div className="flex justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span>₹{subtotal}</span>
      </div>

      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Discount</span>
          <span>-₹{discount}</span>
        </div>
      )}

      <div className="flex justify-between text-sm">
        <span className="text-muted">Shipping</span>
        <span className="text-green-600">Free</span>
      </div>

      <div className="border-t pt-4 flex justify-between font-semibold">
        <span>Total</span>
        <span className="text-primary text-lg">₹{total + shipping}</span>
      </div>

      <Link
        href="/checkout"
        className="block text-center bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition"
      >
        Proceed to Checkout
      </Link>
    </div>
  )
}
