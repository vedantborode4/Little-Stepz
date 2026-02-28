"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { WishlistService } from "../../lib/services/wishlist.service"
import { useWishlistStore } from "../../store/useWishlistStore"
import WishlistItem from "../../components/wishlist/WishlistItem"

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      await useWishlistStore.getState().fetchWishlist() // keeps hearts synced globally

      const data = await WishlistService.getWishlist() // full product data

      setItems(data.items)

      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className="py-20 text-center">Loading wishlist...</div>
  }

  if (!items.length) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold">
          Your wishlist is empty ❤️
        </h2>

        <Link
          href="/products"
          className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-medium"
        >
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      <h1 className="text-3xl font-bold text-primary mb-8">
        Wishlist
      </h1>

      <div className="bg-white border rounded-xl px-6">
        {items.map((item) => (
          <WishlistItem
            key={item.product.id}
            item={item}
            onRemoved={() =>
              setItems((prev) =>
                prev.filter((p) => p.product.id !== item.product.id)
              )
            }
          />
        ))}
      </div>
    </div>
  )
}
