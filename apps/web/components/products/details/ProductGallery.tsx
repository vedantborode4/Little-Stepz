"use client"

import Image from "next/image"
import { useState } from "react"
import type { ProductImage } from "../../../types/product"

export default function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0)

  const mainImage = images?.[active]?.url || "/placeholder.png"

  return (
    <div className="space-y-4">

      <div className="border rounded-xl p-4 bg-white">
        <Image
          src={mainImage}
          alt=""
          width={500}
          height={500}
          className="mx-auto object-contain h-[420px]"
        />
      </div>

      <div className="flex gap-3">
        {images?.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setActive(i)}
            className={`border rounded-lg p-2 ${
              i === active ? "border-primary" : ""
            }`}
          >
            <Image src={img.url} alt="" width={60} height={60} />
          </button>
        ))}
      </div>

    </div>
  )
}
