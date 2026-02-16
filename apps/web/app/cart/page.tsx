"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"
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

  /* 🔄 Loading */
  if (isLoading) {
    return <div className="py-24 text-center">Loading cart...</div>
  }

  /* 🛒 Empty state */
  if (!items || items.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">
          Your cart feels lonely 🛒
        </h2>

        <p className="text-muted">
          Looks like you haven’t added anything yet.
        </p>

        <Link
          href="/products"
          className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition"
        >
          Start Shopping
        </Link>
      </div>
    )
  }

  /* 🧾 Cart */
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8">
        Cart
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantId ?? ""}`}
              item={item}
            />
          ))}
        </div>

        {/* RIGHT */}
        <CartSummary />
      </div>
    </div>
  )
}
