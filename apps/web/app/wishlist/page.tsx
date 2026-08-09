"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, ArrowRight } from "lucide-react"
import { WishlistService } from "../../lib/services/wishlist.service"
import { useWishlistStore } from "../../store/useWishlistStore"
import { useAuthStore } from "../../store/auth.store"
import ProductCard from "../../components/products/ProductCard"

function WishlistSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-6">
      <div className="h-7 bg-surface-2 rounded-full w-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="w-full aspect-square bg-surface-2" />
            <div className="p-2.5 sm:p-4 space-y-2">
              <div className="h-3.5 bg-surface-2 rounded-full w-3/4" />
              <div className="h-4 bg-surface-2 rounded-full w-1/2" />
              <div className="h-8 bg-surface-2 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const savedIds = useWishlistStore((s) => s.items)

  // Gate on the persisted session flag, NOT on a readable token. The backend's
  // accessToken cookie is httpOnly and its JS-visible copy dies with the browser
  // session, so the old `getAccessToken()` check declared signed-in users guests
  // and returned an empty list without ever calling the API — which also denied
  // the 401-refresh interceptor the chance to restore the session. Guests still
  // short-circuit here, so they get the empty state rather than a sign-in bounce.
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (!useAuthStore.getState().isAuthenticated) {
          setItems([])
          return
        }
        const data = await WishlistService.getWishlist()
        setItems(data.items)
        // Seed the store from the same response so hearts render filled without
        // a second round-trip.
        useWishlistStore.setState({ items: data.items.map((i: any) => i.product.id) })
      } catch (err: any) {
        if (err?.response?.status !== 401) {
          console.error(
            `[wishlist] Failed to load wishlist: ${err?.response?.data?.message ?? err?.message ?? "unknown error"}`
          )
        }
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <WishlistSkeleton />

  // Hide anything un-hearted in this session so the grid reacts to ProductCard's
  // toggle, but never hide what the store simply hasn't loaded — an id absent
  // from `savedIds` because the store is empty must still render.
  const visibleItems = savedIds.length
    ? items.filter((item) => savedIds.includes(item.product.id))
    : items

  if (!visibleItems.length) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 flex flex-col items-center gap-5">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Heart size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text">Your wishlist is empty</h2>
          <p className="text-sm text-faint mt-1.5">Save products you love to find them later.</p>
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
          <h1 className="text-xl font-bold text-text">Wishlist</h1>
          <p className="text-xs text-faint mt-0.5">
            {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"} saved
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {visibleItems.map((item) => (
          <ProductCard key={item.product.id} product={item.product} />
        ))}
      </div>
    </div>
  )
}
