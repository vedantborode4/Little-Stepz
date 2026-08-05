"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import type { ProductImage } from "../../../types/product"
import { ZoomIn, X } from "lucide-react"
import { cldFit } from "../../../lib/utils/cloudinaryUrl"

export default function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const activeUrl = images?.[active]?.url || "/placeholder.webp"

  useEffect(() => {
    if (!zoomed) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false)
    }
    window.addEventListener("keydown", onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [zoomed])

  return (
    <>
      <div className="space-y-3">
        {/* Main image */}
        <div
          className="relative border border-border rounded-[10px] bg-surface overflow-hidden group cursor-zoom-in shadow-card"
          onClick={() => setZoomed(true)}
        >
          <Image
            src={cldFit(activeUrl, 1200)}
            alt=""
            width={800}
            height={800}
            className="w-full object-contain h-[420px] transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-4 right-4 bg-surface/90 border border-border rounded-xl p-2 opacity-0 group-hover:opacity-100 transition shadow-sm">
            <ZoomIn size={16} className="text-muted" />
          </div>
          {images?.[active] && (
            <div className="absolute bottom-4 left-4 bg-surface/90 border border-border rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm">
              {active + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images?.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
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
      </div>

      {/* Zoom lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setZoomed(false)}
        >
          <div className="relative bg-surface rounded-2xl p-4 max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setZoomed(false)}
              className="absolute top-3 right-3 z-10 bg-surface/90 border border-border rounded-xl p-2 text-muted hover:text-primary hover:border-primary/30 shadow-sm transition"
            >
              <X size={18} />
            </button>
            <Image
              src={activeUrl}
              alt=""
              width={800}
              height={800}
              className="object-contain w-full h-auto max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </>
  )
}
