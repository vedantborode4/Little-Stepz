"use client"

import { useCartStore } from "../../store/useCartStore"
import { useCheckoutStore } from "../../store/useCheckoutStore"
import { useAddressStore } from "../../store/useAddressStore"
import { useRouter } from "next/navigation"
import CouponBox from "../cart/CouponBox"
import { ShoppingBag, Loader2, Tag, Truck, CreditCard } from "lucide-react"

export default function CheckoutSummary({
  isValid = true,
  addressId,
}: {
  isValid?: boolean
  addressId?: string
}) {
  const router = useRouter()

  const { subtotal, total, discount, couponCode } = useCartStore()
  const { placeOrder, placingOrder, paymentMethod } = useCheckoutStore()

  const storeAddressId = useAddressStore((s) => s.selectedAddressId)
  const resolvedAddressId = addressId || storeAddressId || ""

  const handleOrder = async () => {
    if (!resolvedAddressId) return
    const orderId = await placeOrder(resolvedAddressId)
    if (orderId) router.push(`/order-success/${orderId}`)
  }

  const canPlace = isValid && !!resolvedAddressId && !placingOrder

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-card p-6 space-y-5 h-fit sticky top-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-primary/10 rounded-xl">
          <ShoppingBag size={15} className="text-primary" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Order Summary</h2>
      </div>

      {/* Coupon */}
      <CouponBox />

      {/* Breakdown */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-medium text-gray-900">₹{subtotal?.toLocaleString("en-IN")}</span>
        </div>

        {couponCode && (
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-green-600">
              <Tag size={12} />
              Coupon ({couponCode})
            </span>
            <span className="font-medium text-green-600">−₹{discount?.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-500">
            <Truck size={13} />
            Shipping
          </span>
          <span className="font-medium text-green-600">Free</span>
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
        <span className="font-semibold text-gray-900">Total</span>
        <span className="text-xl font-bold text-primary">₹{total?.toLocaleString("en-IN")}</span>
      </div>

      {/* Payment method badge */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <CreditCard size={13} />
          Payment
        </span>
        <span className="text-xs font-semibold text-gray-700">
          {paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={handleOrder}
        disabled={!canPlace}
        className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
      >
        {placingOrder ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {paymentMethod === "COD" ? "Placing order…" : "Preparing payment…"}
          </>
        ) : (
          paymentMethod === "COD" ? "Place Order" : "Proceed to Pay"
        )}
      </button>

      {!resolvedAddressId && (
        <p className="text-xs text-amber-600 text-center bg-amber-50 border border-amber-100 rounded-lg py-2 px-3">
          Please select a delivery address to continue.
        </p>
      )}

      {!isValid && (
        <p className="text-xs text-red-500 text-center bg-red-50 border border-red-100 rounded-lg py-2 px-3">
          Cart updated. Please review before placing order.
        </p>
      )}

      <p className="text-[11px] text-center text-gray-400">
        🔒 Secure & encrypted checkout
      </p>
    </div>
  )
}
