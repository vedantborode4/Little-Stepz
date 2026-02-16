"use client"

import { useCheckoutStore } from "../../store/useCheckoutStore"

export default function PaymentSection({
  onContinue,
}: {
  onContinue: () => void
}) {
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)

  return (
    <div className="space-y-3">
      <label className="flex gap-3 border p-4 rounded-lg cursor-pointer">
        <input
          type="radio"
          checked={paymentMethod === "COD"}
          onChange={() => setPaymentMethod("COD")}
        />
        Cash on Delivery
      </label>

      <label className="flex gap-3 border p-4 rounded-lg cursor-pointer">
        <input
          type="radio"
          checked={paymentMethod === "ONLINE"}
          onChange={() => setPaymentMethod("ONLINE")}
        />
        Pay Online (Razorpay)
      </label>

      <button
        onClick={onContinue}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium"
      >
        Continue to Pay
      </button>
    </div>
  )
}
