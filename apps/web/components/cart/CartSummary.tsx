"use client"

import { useCartStore } from "../../store/useCartStore"
import Link from "next/link"

export default function CartSummary() {
  const subtotal = useCartStore((s) => s.subtotal)
  const items = useCartStore((s) => s.items)

  const shipping = items.length > 0 ? 0 : 0
  const total = subtotal + shipping

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 h-fit space-y-4">
      <h2 className="text-lg font-semibold">Order Summary</h2>

      {/* SUBTOTAL */}
      <div className="flex justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span>₹{subtotal}</span>
      </div>

      {/* SHIPPING */}
      <div className="flex justify-between text-sm">
        <span className="text-muted">Shipping</span>
        <span className="text-green-600">Free</span>
      </div>

      <div className="border-t pt-4 flex justify-between font-semibold">
        <span>Total</span>
        <span className="text-primary text-lg">₹{total}</span>
      </div>

      {/* CTA */}
      <Link
        href="/checkout"
        className="block text-center bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition"
      >
        Proceed to Checkout
      </Link>
    </div>
  )
}
