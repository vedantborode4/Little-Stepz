"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ShoppingBag, ArrowRight } from "lucide-react"
import { useCartStore } from "../../store/useCartStore"
import CartItem from "../../components/cart/CartItem"
import CartSummary from "../../components/cart/CartSummary"

function CartSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10 animate-pulse">
      <div className="h-7 bg-gray-100 rounded-full w-24 mb-6 sm:mb-8" />
      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 sm:p-5 border-b border-gray-100">
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gray-100 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/4" />
                <div className="h-8 bg-gray-100 rounded-xl w-32 mt-3" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 h-64 animate-pulse" />
      </div>
    </div>
  )
}

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const isLoading = useCartStore((s) => s.isLoading)
  const total = useCartStore((s) => s.total)

  useEffect(() => {
    useCartStore.getState().fetchCart()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) return <CartSkeleton />

  if (!items || items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center gap-5">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ShoppingBag size={28} className="text-primary sm:w-8 sm:h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Your cart is empty</h2>
          <p className="text-sm text-gray-400 mt-1.5">Looks like you haven't added anything yet.</p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-primary text-white px-5 sm:px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          Start Shopping
          <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 pb-28 lg:pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl">
          <ShoppingBag size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} {items.length === 1 ? "item" : "items"} in your cart
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantId ?? ""}`}
              item={item}
            />
          ))}
        </div>

        {/* Desktop summary */}
        <div className="hidden lg:block">
          <CartSummary />
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 py-3 shadow-xl safe-area-pb">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-lg font-bold text-primary">₹{total?.toLocaleString("en-IN")}</p>
          </div>
          <Link
            href="/checkout"
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm text-sm"
          >
            Checkout
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
