"use client"

import { useCartStore } from "../../store/useCartStore"

export default function CartSummary() {
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.getSubtotal())

  const delivery = 10
  const discount = 20.02
  const total = subtotal - discount + delivery

  return (
    <div className="bg-white border rounded-xl p-6 h-fit space-y-4">
      <div className="flex justify-between">
        <span>Price</span>
        <span>₹{subtotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-green-600">
        <span>Discount</span>
        <span>-₹{discount}</span>
      </div>

      <div className="flex justify-between">
        <span>Delivery Charges</span>
        <span>₹{delivery}</span>
      </div>

      <hr />

      <div className="flex justify-between font-semibold text-lg">
        <span>Total Payable</span>
        <span className="text-primary">₹{total.toFixed(2)}</span>
      </div>

      <button className="w-full bg-primary text-white py-3 rounded-xl font-medium">
        Proceed to Checkout
      </button>
    </div>
  )
}
