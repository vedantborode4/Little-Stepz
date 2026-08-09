"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import type { ProductImage } from "../../../types/product"
import { ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react"
import { cldFit } from "../../../lib/utils/cloudinaryUrl"

const PLACEHOLDER: ProductImage = { id: "placeholder", url: "/placeholder.webp" }

/** A drag longer than this is a swipe, not a tap — don't open the lightbox. */
const TAP_SLOP = 10

const scrollToSlide = (el: HTMLDivElement | null, index: number, smooth = false) => {
  if (!el) return
  el.scrollTo({ left: index * el.clientWidth, behavior: smooth ? "smooth" : "auto" })
}

export default function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const zoomTrackRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const activeRef = useRef(0)
  activeRef.current = active

  const slides = images?.length ? images : [PLACEHOLDER]

  /** Step the visible slide by ±1, clamped. Drives both the inline track and the lightbox. */
  const step = (delta: number) => {
    const next = Math.min(slides.length - 1, Math.max(0, activeRef.current + delta))
    if (next === activeRef.current) return
    setActive(next)
    scrollToSlide(zoomed ? zoomTrackRef.current : trackRef.current, next, true)
  }

  /** Scroll the thumbnail strip by roughly one visible page. */
  const scrollRail = (delta: number) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({ left: delta * el.clientWidth * 0.8, behavior: "smooth" })
  }

  const atStart = active === 0
  const atEnd = active === slides.length - 1
  const multiple = slides.length > 1

  const arrowClass =
    "absolute top-1/2 -translate-y-1/2 z-10 bg-surface/90 border border-border rounded-full p-2 " +
    "text-muted shadow-sm transition hover:text-primary hover:border-primary/30 " +
    "disabled:opacity-0 disabled:pointer-events-none"

  const syncActive = (el: HTMLDivElement) => {
    if (!el.clientWidth) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActive(Math.min(slides.length - 1, Math.max(0, index)))
  }

  useEffect(() => {
    if (!zoomed) return

    // Open the lightbox on whichever image the inline track is showing.
    scrollToSlide(zoomTrackRef.current, activeRef.current)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const delta = e.key === "ArrowLeft" ? -1 : 1
        const next = Math.min(slides.length - 1, Math.max(0, activeRef.current + delta))
        if (next === activeRef.current) return
        setActive(next)
        scrollToSlide(zoomTrackRef.current, next, true)
        return
      }
      if (e.key !== "Escape") return
      setZoomed(false)
      scrollToSlide(trackRef.current, activeRef.current)
    }
    window.addEventListener("keydown", onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [zoomed, slides.length])

  // Carry the lightbox's index back to the inline track on close.
  const closeZoom = () => {
    setZoomed(false)
    scrollToSlide(trackRef.current, activeRef.current)
  }

  return (
    <>
      <div className="space-y-3">
        {/* Main image — swipeable */}
        <div className="relative border border-border rounded-[10px] bg-surface overflow-hidden group cursor-zoom-in shadow-card">
          <div
            ref={trackRef}
            onScroll={(e) => syncActive(e.currentTarget)}
            onPointerDown={(e) => (pointerStart.current = { x: e.clientX, y: e.clientY })}
            onClick={(e) => {
              const start = pointerStart.current
              if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) return
              setZoomed(true)
            }}
            className="flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((img, i) => (
              <div key={img.id} className="w-full flex-shrink-0 snap-center overflow-hidden">
                <Image
                  src={cldFit(img.url, 1200)}
                  alt=""
                  width={800}
                  height={800}
                  loading={Math.abs(i - active) <= 1 ? "eager" : "lazy"}
                  className="w-full object-contain h-[420px] transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ))}
          </div>

          {multiple && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                disabled={atStart}
                onClick={(e) => { e.stopPropagation(); step(-1) }}
                className={`${arrowClass} left-3`}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Next image"
                disabled={atEnd}
                onClick={(e) => { e.stopPropagation(); step(1) }}
                className={`${arrowClass} right-3`}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          <div className="absolute top-4 right-4 bg-surface/90 border border-border rounded-xl p-2 opacity-0 group-hover:opacity-100 transition shadow-sm pointer-events-none">
            <ZoomIn size={16} className="text-muted" />
          </div>
          <div className="absolute bottom-4 left-4 bg-surface/90 border border-border rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm pointer-events-none">
            {active + 1} / {slides.length}
          </div>
        </div>

        {/* Thumbnails — arrows replace the scrollbar as the scroll affordance */}
        <div className="relative">
          {multiple && (
            <button
              type="button"
              aria-label="Scroll thumbnails left"
              onClick={() => scrollRail(-1)}
              className={`${arrowClass} left-0 p-1.5`}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div
            ref={railRef}
            className={`flex gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              multiple ? "px-9" : ""
            }`}
          >
          {images?.map((img, i) => (
            <button
              key={img.id}
              onClick={() => {
                setActive(i)
                scrollToSlide(trackRef.current, i, true)
              }}
              className={`flex-shrink-0 border-2 rounded-sm p-1.5 transition-all duration-150 bg-surface ${
                i === active
                  ? "border-primary shadow-sm"
                  : "border-border hover:border-border"
              }`}
            >
              <Image
                src={cldFit(img.url, 200)}
                alt=""
                width={64}
                height={64}
                className="object-contain w-14 h-14 rounded-[6px]"
              />
            </button>
          ))}
          </div>
          {multiple && (
            <button
              type="button"
              aria-label="Scroll thumbnails right"
              onClick={() => scrollRail(1)}
              className={`${arrowClass} right-0 p-1.5`}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Zoom lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={closeZoom}
        >
          <div className="relative bg-surface rounded-2xl p-4 max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              onClick={closeZoom}
              className="absolute top-3 right-3 z-10 bg-surface/90 border border-border rounded-xl p-2 text-muted hover:text-primary hover:border-primary/30 shadow-sm transition"
            >
              <X size={18} />
            </button>

            <div
              ref={zoomTrackRef}
              onScroll={(e) => syncActive(e.currentTarget)}
              className="flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {slides.map((img) => (
                <div key={img.id} className="w-full flex-shrink-0 snap-center">
                  <Image
                    src={img.url}
                    alt=""
                    width={800}
                    height={800}
                    className="object-contain w-full h-auto max-h-[80vh]"
                  />
                </div>
              ))}
            </div>

            {multiple && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  disabled={atStart}
                  onClick={() => step(-1)}
                  className={`${arrowClass} left-6`}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  disabled={atEnd}
                  onClick={() => step(1)}
                  className={`${arrowClass} right-6`}
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface/90 border border-border rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm pointer-events-none">
                  {active + 1} / {slides.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
