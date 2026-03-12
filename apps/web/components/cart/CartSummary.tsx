"use client"

import { useCartStore } from "../../store/useCartStore"
import Link from "next/link"
import { ArrowRight, ShoppingBag, Tag } from "lucide-react"
import CouponBox from "./CouponBox"

export default function CartSummary() {
  const { subtotal, total, discount, couponCode, items } = useCartStore()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 h-fit space-y-5 sticky top-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-primary/10 rounded-xl">
          <ShoppingBag size={15} className="text-primary" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Order Summary</h2>
      </div>

      {/* Coupon */}
      <CouponBox />

      {/* Price breakdown */}
      <div className="space-y-3 pt-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
          <span className="font-medium text-gray-900">₹{subtotal?.toLocaleString("en-IN")}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-green-600">
              <Tag size={13} />
              Coupon ({couponCode})
            </span>
            <span className="font-medium text-green-600">−₹{discount?.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Shipping</span>
          <span className="font-medium text-green-600">Free</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-xl font-bold text-primary">₹{total?.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="flex items-center justify-center gap-2 w-full bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
      >
        Proceed to Checkout
        <ArrowRight size={16} />
      </Link>

      <p className="text-[11px] text-center text-gray-400">
        Secure checkout powered by Razorpay
      </p>
    </div>
  )
}
