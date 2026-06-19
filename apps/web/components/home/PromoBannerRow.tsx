"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CategoryService, type CategoryNode } from "../../lib/services/category.service"

interface PromoItem {
  title: string
  image: string
  href: string
}

// Fallback tiles shown until categories have images configured in the admin panel.
const promos: PromoItem[] = [
  { title: "Race into adventure", image: "/promos/promo1.png", href: "/products?search=hotwheels" },
  { title: "Barbie Collection",   image: "/promos/promo2.png", href: "/products?search=barbie" },
  { title: "Marvel Super Heroes", image: "/promos/promo3.png", href: "/products?search=marvel" },
  { title: "Unleash Epic Battle", image: "/promos/promo4.png", href: "/products?search=nerf" },
]

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <section className="container">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">{children}</div>
    </section>
  )
}

export default function PromoBannerRow() {
  const [categories, setCategories] = useState<CategoryNode[] | null>(null)

  useEffect(() => {
    CategoryService.getAll()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  // Top-level categories that have an image — these drive the section once configured.
  const withImage = (categories ?? []).filter((c) => !c.parentId && c.image)

  // While loading (null) or when no category has an image yet, show the fallback promos.
  if (categories === null || withImage.length === 0) {
    return (
      <TileGrid>
        {promos.map((promo) => (
          <Link
            key={promo.title}
            href={promo.href}
            className="relative group rounded-xl overflow-hidden block h-[120px] sm:h-[160px] md:h-[180px] lg:h-[200px]"
          >
            <Image
              src={promo.image}
              alt={promo.title}
              fill
              className="object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition" />
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 text-white font-semibold text-xs sm:text-sm md:text-base drop-shadow leading-tight">
              {promo.title}
            </div>
          </Link>
        ))}
      </TileGrid>
    )
  }

  return (
    <TileGrid>
      {withImage.map((cat) => (
        <Link
          key={cat.id}
          href={`/products/category/${cat.slug}`}
          className="relative group rounded-xl overflow-hidden block h-[120px] sm:h-[160px] md:h-[180px] lg:h-[200px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cat.image!}
            alt={cat.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition" />
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 text-white font-semibold text-xs sm:text-sm md:text-base drop-shadow leading-tight">
            {cat.name}
          </div>
        </Link>
      ))}
    </TileGrid>
  )
}
