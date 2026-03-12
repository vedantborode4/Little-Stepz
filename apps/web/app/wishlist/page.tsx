"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, ArrowRight } from "lucide-react"
import { WishlistService } from "../../lib/services/wishlist.service"
import { useWishlistStore } from "../../store/useWishlistStore"
import WishlistItem from "../../components/wishlist/WishlistItem"

function WishlistSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-6">
      <div className="h-7 bg-gray-100 rounded-full w-32" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 py-4 border-b border-gray-100 last:border-none">
            <div className="w-[72px] h-[72px] bg-gray-100 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded-full w-2/3" />
              <div className="h-3 bg-gray-100 rounded-full w-1/4" />
              <div className="h-4 bg-gray-100 rounded-full w-1/5 mt-2" />
            </div>
            <div className="h-9 w-28 bg-gray-100 rounded-xl self-center" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await useWishlistStore.getState().fetchWishlist()
      const data = await WishlistService.getWishlist()
      setItems(data.items)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <WishlistSkeleton />

  if (!items.length) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 flex flex-col items-center gap-5">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Heart size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Your wishlist is empty</h2>
          <p className="text-sm text-gray-400 mt-1.5">Save products you love to find them later.</p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          Browse Products
          <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Heart size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wishlist</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} {items.length === 1 ? "item" : "items"} saved
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-card px-6 py-1">
        {items.map((item) => (
          <WishlistItem
            key={item.product.id}
            item={item}
            onRemoved={() =>
              setItems((prev) => prev.filter((p) => p.product.id !== item.product.id))
            }
          />
        ))}
      </div>
    </div>
  )
}
