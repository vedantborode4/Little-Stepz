"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BannerService } from "../../lib/services/banner.service"
import type { AdminBanner } from "../../lib/services/admin-banner.service"
import HeroFallback from "./HeroFallback"

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

  useEffect(() => {
    if (banners.length < 2) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [banners.length, next])

  const trackClick = async (banner: AdminBanner) => {
    try {
      await fetch(`/api/banners/${banner.id}/click`, { method: "POST" }).catch(() => {})
    } catch { /* non-fatal */ }
  }

  if (loading) {
    return (
      <div className="w-full aspect-32/15 lg:aspect-auto lg:h-[calc(100vh-4rem)] bg-surface-2 animate-pulse" />
    )
  }

  if (!banners.length) return <HeroFallback />

  const b = banners[current]!

  // The whole slide is clickable when the banner has a link — no separate "Shop Now" button.
  const slide = (
    <div className="relative w-full aspect-32/15 lg:aspect-auto lg:h-[calc(100vh-4rem)]">
      <img
        key={b.id}
        src={b.imageUrl}
        alt={b.altText ?? b.title}
        className="w-full h-full object-cover transition-opacity duration-500"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />

      {/* Text */}
      <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-8 md:px-12">
        {b.title && (
          <h2 className="text-base sm:text-2xl md:text-4xl font-bold text-white leading-tight max-w-[220px] sm:max-w-md drop-shadow">
            {b.title}
          </h2>
        )}
        {b.subtitle && (
          <p className="text-xs sm:text-sm md:text-base text-white/80 mt-1 sm:mt-2 max-w-[200px] sm:max-w-sm drop-shadow line-clamp-2 sm:line-clamp-none">
            {b.subtitle}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative w-full overflow-hidden group">
      {b.linkUrl ? (
        <Link href={b.linkUrl} onClick={() => trackClick(b)} className="block" aria-label={b.title || "View banner"}>
          {slide}
        </Link>
      ) : (
        slide
      )}

      {/* Navigation arrows — always visible on mobile, hover on desktop */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md sm:opacity-0 sm:group-hover:opacity-100 opacity-80 transition hover:bg-white"
          >
            <ChevronLeft size={14} className="text-gray-700" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md sm:opacity-0 sm:group-hover:opacity-100 opacity-80 transition hover:bg-white"
          >
            <ChevronRight size={14} className="text-gray-700" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-5 sm:w-6 bg-white" : "w-1 sm:w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
