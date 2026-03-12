"use client"

import Image from "next/image"
import { useState } from "react"
import type { ProductImage } from "../../../types/product"
import { ZoomIn } from "lucide-react"

export default function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const mainImage = images?.[active]?.url || "/placeholder.png"

  return (
    <>
      <div className="space-y-3">
        {/* Main image */}
        <div
          className="relative border border-gray-100 rounded-2xl bg-white overflow-hidden group cursor-zoom-in shadow-card"
          onClick={() => setZoomed(true)}
        >
          <Image
            src={mainImage}
            alt=""
            width={600}
            height={600}
            className="mx-auto object-contain h-[420px] transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-4 right-4 bg-white/90 border border-gray-100 rounded-xl p-2 opacity-0 group-hover:opacity-100 transition shadow-sm">
            <ZoomIn size={16} className="text-gray-500" />
          </div>
          {images?.[active] && (
            <div className="absolute bottom-4 left-4 bg-white/90 border border-gray-100 rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm">
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
              className={`flex-shrink-0 border-2 rounded-xl p-1.5 transition-all duration-150 bg-white ${
                i === active
                  ? "border-primary shadow-sm"
                  : "border-gray-100 hover:border-gray-300"
              }`}
            >
              <Image
                src={img.url}
                alt=""
                width={64}
                height={64}
                className="object-contain w-14 h-14"
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
          <div className="bg-white rounded-2xl p-4 max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={mainImage}
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
