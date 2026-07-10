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
      <div className="h-7 bg-surface-2 rounded-full w-24 mb-6 sm:mb-8" />
      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 sm:p-5 border-b border-border">
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-surface-2 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-2 rounded-full w-3/4" />
                <div className="h-3 bg-surface-2 rounded-full w-1/4" />
                <div className="h-8 bg-surface-2 rounded-xl w-32 mt-3" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border h-64 animate-pulse" />
      </div>
    </div>
  )
}

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const isLoading = useCartStore((s) => s.isLoading)

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
          <h2 className="text-lg sm:text-xl font-bold text-text">Your cart is empty</h2>
          <p className="text-sm text-faint mt-1.5">Looks like you haven't added anything yet.</p>
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
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl">
          <ShoppingBag size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text">Shopping Cart</h1>
          <p className="text-xs text-faint mt-0.5">
            {items.length} {items.length === 1 ? "item" : "items"} in your cart
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border shadow-card overflow-hidden">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantId ?? ""}`}
              item={item}
            />
          ))}
        </div>

        {/* Order summary — every breakpoint. Stacks under the items on mobile/tablet
            and sticks alongside them on desktop. */}
        <CartSummary />
      </div>
    </div>
  )
}
