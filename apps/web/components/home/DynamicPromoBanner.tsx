"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BannerService } from "../../lib/services/banner.service"
import type { AdminBanner } from "../../lib/services/admin-banner.service"

interface Props {
  position: "HOME_MID" | "CATEGORY_TOP" | "CHECKOUT_TOP"
  className?: string
}

export default function DynamicPromoBanner({ position, className = "" }: Props) {
  const [banners, setBanners] = useState<AdminBanner[]>([])

  useEffect(() => {
    BannerService.getByPosition(position).then(setBanners)
  }, [position])

  if (!banners.length) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {banners.map((b) => (
        <div key={b.id} className="relative w-full overflow-hidden rounded-2xl">
          {b.linkUrl ? (
            <Link href={b.linkUrl}>
              <img
                src={b.imageUrl}
                alt={b.altText ?? b.title}
                className="w-full object-cover hover:scale-[1.01] transition-transform duration-300"
                style={{ maxHeight: 200 }}
              />
            </Link>
          ) : (
            <img
              src={b.imageUrl}
              alt={b.altText ?? b.title}
              className="w-full object-cover"
              style={{ maxHeight: 200 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
