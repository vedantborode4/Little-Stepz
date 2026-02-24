"use client"

import { useState } from "react"
import { useCartStore } from "../../store/useCartStore"
import { toast } from "sonner"
import { Loader2, Tag, TicketPercent } from "lucide-react"

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
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Invalid coupon"
      )
    }
  }


  if (couponCode) {
    return (
      <div className="border border-green-300 bg-green-50 p-3 rounded-xl text-sm space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <Tag size={16} />
            {couponCode}
          </div>

          <button
            onClick={removeCoupon}
            className="text-red-500 font-medium hover:underline"
          >
            Remove
          </button>
        </div>

        <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
          <TicketPercent size={14} />
          You saved ₹{discount}
        </div>
      </div>
    )
  }


  return (
    <div className="flex gap-2">
      <input
        value={code}
        onChange={(e) =>
          setCode(e.target.value.toUpperCase())
        }
        placeholder="Enter coupon code"
        className="flex-1 border rounded-xl px-3 py-2 text-sm"
      />

      <button
        onClick={handleApply}
        disabled={isValidating}
        className="min-w-[90px] bg-primary text-white px-4 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {isValidating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Apply"
        )}
      </button>
    </div>
  )
}
