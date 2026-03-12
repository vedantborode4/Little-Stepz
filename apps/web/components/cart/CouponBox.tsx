"use client"

import { useState } from "react"
import { useCartStore } from "../../store/useCartStore"
import { toast } from "sonner"
import { Loader2, Tag, X, TicketPercent } from "lucide-react"

export default function CouponBox() {
  const [code, setCode] = useState("")

  const applyCoupon = useCartStore((s) => s.applyCoupon)
  const removeCoupon = useCartStore((s) => s.removeCoupon)
  const couponCode = useCartStore((s) => s.couponCode)
  const discount = useCartStore((s) => s.discount)
  const isValidating = useCartStore((s) => s.isValidatingCoupon)

  const handleApply = async () => {
    if (!code.trim()) {
      toast.error("Enter a coupon code")
      return
    }
    try {
      await applyCoupon(code.trim())
      toast.success("Coupon applied 🎉")
      setCode("")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Invalid coupon")
    }
  }

  if (couponCode) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
            <TicketPercent size={14} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">{couponCode}</p>
            <p className="text-[11px] text-green-600">You saved ₹{discount?.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <button
          onClick={removeCoupon}
          className="p-1.5 rounded-lg hover:bg-green-100 transition text-green-600"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          placeholder="Enter coupon code"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary transition"
        />
      </div>
      <button
        onClick={handleApply}
        disabled={isValidating}
        className="min-w-[80px] bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 hover:opacity-90 transition shadow-sm"
      >
        {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
      </button>
    </div>
  )
}
