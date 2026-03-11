"use client"

import { useCheckoutStore } from "../../store/useCheckoutStore"
import { Banknote, CreditCard } from "lucide-react"

export default function PaymentSection() {
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)

  return (
    <div className="space-y-3">
      <label
        className={`flex items-center gap-4 border rounded-xl p-4 cursor-pointer transition ${
          paymentMethod === "COD"
            ? "border-primary bg-primary/5"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          type="radio"
          className="accent-primary"
          checked={paymentMethod === "COD"}
          onChange={() => setPaymentMethod("COD")}
        />
        <Banknote size={18} className="text-gray-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">Cash on Delivery</p>
          <p className="text-xs text-gray-500">Pay when your order arrives</p>
        </div>
      </label>

      <label
        className={`flex items-center gap-4 border rounded-xl p-4 cursor-pointer transition ${
          paymentMethod === "ONLINE"
            ? "border-primary bg-primary/5"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          type="radio"
          className="accent-primary"
          checked={paymentMethod === "ONLINE"}
          onChange={() => setPaymentMethod("ONLINE")}
        />
        <CreditCard size={18} className="text-gray-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">Pay Online</p>
          <p className="text-xs text-gray-500">Credit/Debit card, UPI, Net Banking via Razorpay</p>
        </div>
      </label>

      <p className="text-xs text-gray-400 pt-1">
        Click <span className="font-medium text-gray-600">Place Order</span> in the summary panel to confirm.
      </p>
    </div>
  )
}
