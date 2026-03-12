"use client"

import { useCheckoutStore } from "../../store/useCheckoutStore"
import { Banknote, CreditCard, Shield } from "lucide-react"

const methods = [
  {
    id: "COD",
    icon: Banknote,
    label: "Cash on Delivery",
    description: "Pay when your order arrives at your door",
    badge: null,
  },
  {
    id: "ONLINE",
    icon: CreditCard,
    label: "Pay Online",
    description: "Credit/Debit card, UPI, Net Banking via Razorpay",
    badge: "Instant",
  },
] as const

export default function PaymentSection() {
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)

  return (
    <div className="space-y-3">
      {methods.map(({ id, icon: Icon, label, description, badge }) => {
        const active = paymentMethod === id
        return (
          <label
            key={id}
            className={`flex items-center gap-4 border rounded-xl p-4 cursor-pointer transition-all ${
              active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <input
              type="radio"
              className="accent-primary"
              checked={active}
              onChange={() => setPaymentMethod(id)}
            />
            <div className={`p-2 rounded-xl ${active ? "bg-primary/10" : "bg-gray-100"}`}>
              <Icon size={17} className={active ? "text-primary" : "text-gray-500"} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                {badge && (
                  <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
          </label>
        )
      })}

      <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
        <Shield size={13} className="text-secondary" />
        Click <span className="font-semibold text-gray-600 mx-1">Place Order</span> in the summary to confirm.
      </div>
    </div>
  )
}
