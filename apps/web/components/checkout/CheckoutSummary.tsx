"use client"

import { useCartStore } from "../../store/useCartStore"
import { useCheckoutStore } from "../../store/useCheckoutStore"
import { useAddressStore } from "../../store/useAddressStore"
import { useRouter } from "next/navigation"
import CouponBox from "../cart/CouponBox"

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

  // Use prop-passed addressId first, fall back to store (set by CheckoutAddressSection)
  const storeAddressId = useAddressStore((s) => s.selectedAddressId)
  const resolvedAddressId = addressId || storeAddressId || ""

  const handleOrder = async () => {
    if (!resolvedAddressId) return

    const orderId = await placeOrder(resolvedAddressId)

    if (orderId) {
      router.push(`/order-success/${orderId}`)
    }
  }

  const canPlace = isValid && !!resolvedAddressId && !placingOrder

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5 h-fit sticky top-6">
      <h2 className="text-lg font-semibold">Order Summary</h2>

      <CouponBox />

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>₹{subtotal}</span>
      </div>

      {couponCode && (
        <div className="flex justify-between text-sm text-primary">
          <span>Coupon ({couponCode})</span>
          <span>-₹{discount}</span>
        </div>
      )}

      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span className="text-green-600">Free</span>
      </div>

      <div className="border-t pt-3 flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span className="text-primary">₹{total}</span>
      </div>

      {/* Payment method reminder */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 flex justify-between">
        <span>Payment</span>
        <span className="font-medium text-gray-700">
          {paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"}
        </span>
      </div>

      <button
        onClick={handleOrder}
        disabled={!canPlace}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2"
      >
        {placingOrder ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            {paymentMethod === "COD" ? "Placing order…" : "Preparing payment…"}
          </>
        ) : (
          paymentMethod === "COD" ? "Place Order" : "Proceed to Pay"
        )}
      </button>

      {!resolvedAddressId && (
        <p className="text-xs text-amber-600 text-center">
          Please select a delivery address to continue.
        </p>
      )}

      {!isValid && (
        <p className="text-xs text-red-500 text-center">
          Cart updated. Please review before placing order.
        </p>
      )}
    </div>
  )
}
