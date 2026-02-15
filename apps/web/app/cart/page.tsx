"use client"

import { useEffect } from "react"
import { useCartStore } from "../../store/useCartStore"
import CartItem from "../../components/cart/CartItem"
import CartSummary from "../../components/cart/CartSummary"

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const fetchCart = useCartStore((s) => s.fetchCart)
  const isLoading = useCartStore((s) => s.isLoading)

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  if (isLoading) {
    return <div className="py-20 text-center">Loading cart...</div>
  }

  if (!items || items.length === 0) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <p className="text-muted mt-2">Add something you love ❤️</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8">Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border divide-y">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantId ?? "no-variant"}`}
              item={item}
            />
          ))}
        </div>

        <CartSummary />
      </div>
    </div>
  )
}
