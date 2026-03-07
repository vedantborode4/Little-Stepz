"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BannerService } from "../../lib/services/banner.service"
import type { AdminBanner } from "../../lib/services/admin-banner.service"

/**
 * DynamicHeroBanner
 * Fetches HOME_HERO banners from the backend and renders a full-width
 * auto-playing carousel. Falls back gracefully if no banners are live.
 */
export default function DynamicHeroBanner() {
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    BannerService.getByPosition("HOME_HERO")
      .then(setBanners)
      .finally(() => setLoading(false))
  }, [])

  const next = useCallback(() =>
    setCurrent((c) => (c + 1) % banners.length), [banners.length])

  const prev = useCallback(() =>
    setCurrent((c) => (c - 1 + banners.length) % banners.length), [banners.length])

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (banners.length < 2) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [banners.length, next])

  // Track click for analytics
  const trackClick = async (banner: AdminBanner) => {
    try {
      // Fire-and-forget click tracking
      await fetch(`/api/banners/${banner.id}/click`, { method: "POST" }).catch(() => {})
    } catch { /* non-fatal */ }
  }

  if (loading) {
    return (
      <div className="w-full h-64 md:h-96 bg-gray-100 rounded-2xl animate-pulse" />
    )
  }

  if (!banners.length) return null

  const b = banners[current]!

  return (
    <div className="relative w-full overflow-hidden rounded-2xl group">
      {/* Image */}
      <div className="relative w-full h-56 sm:h-72 md:h-96">
        <img
          key={b.id}
          src={b.imageUrl}
          alt={b.altText ?? b.title}
          className="w-full h-full object-cover transition-opacity duration-500"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />

        {/* Text */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12">
          <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight max-w-md drop-shadow">
            {b.title}
          </h2>
          {b.subtitle && (
            <p className="text-sm md:text-base text-white/80 mt-2 max-w-sm drop-shadow">
              {b.subtitle}
            </p>
          )}
          {b.linkUrl && (
            <Link
              href={b.linkUrl}
              onClick={() => trackClick(b)}
              className="mt-5 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition w-fit shadow-lg"
            >
              Shop Now <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition hover:bg-white"
          >
            <ChevronLeft size={16} className="text-gray-700" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition hover:bg-white"
          >
            <ChevronRight size={16} className="text-gray-700" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
