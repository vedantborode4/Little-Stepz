"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BannerService } from "../../lib/services/banner.service"
import type { AdminBanner } from "../../lib/services/admin-banner.service"
import HeroFallback from "./HeroFallback"

/**
 * Tall mobile-only hero (position MOBILE_HERO). Rendered only at mobile widths
 * (the parent wraps it in `md:hidden`); the desktop hero uses HOME_HERO.
 * Falls back to the shared HeroFallback when no mobile banners are configured.
 */
export default function MobileHeroBanner() {
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    BannerService.getByPosition("MOBILE_HERO")
      .then(setBanners)
      .finally(() => setLoading(false))
  }, [])

  const next = useCallback(() => setCurrent((c) => (c + 1) % banners.length), [banners.length])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + banners.length) % banners.length), [banners.length])

  useEffect(() => {
    if (banners.length < 2) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [banners.length, next])

  if (loading) {
    return <div className="w-full h-[45vh] bg-gray-100 animate-pulse" />
  }

  if (!banners.length) return <HeroFallback />

  const b = banners[current]!

  return (
    <div className="relative w-full h-[45vh] overflow-hidden">
      <img
        key={b.id}
        src={b.imageUrl}
        alt={b.altText ?? b.title}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-5">
        {b.title && (
          <h2 className="text-xl font-bold text-white leading-tight max-w-[220px] drop-shadow">{b.title}</h2>
        )}
        {b.subtitle && (
          <p className="text-xs text-white/80 mt-1 max-w-[200px] drop-shadow line-clamp-2">{b.subtitle}</p>
        )}
        {b.linkUrl && (
          <Link
            href={b.linkUrl}
            className="mt-3 inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs font-medium w-fit shadow-lg"
          >
            Shop Now <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"
          >
            <ChevronLeft size={15} className="text-gray-700" />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"
          >
            <ChevronRight size={15} className="text-gray-700" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
