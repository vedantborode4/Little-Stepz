"use client"

import Link from "next/link"
import type { Category } from "../../types/category"
import { Grid3x3 } from "lucide-react"

interface Props {
  categories: Category[]
}

const CATEGORY_COLORS = [
  "bg-red-50 text-red-600 border-red-100",
  "bg-blue-50 text-blue-600 border-blue-100",
  "bg-green-50 text-green-600 border-green-100",
  "bg-yellow-50 text-yellow-600 border-yellow-100",
  "bg-purple-50 text-purple-600 border-purple-100",
  "bg-teal-50 text-teal-600 border-teal-100",
]

export default function CategoryGrid({ categories }: Props) {
  if (!categories?.length) return null

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {categories.map((cat, index) => {
        const key = cat.id || cat.slug || `cat-${index}`
        const colorClass = CATEGORY_COLORS[index % CATEGORY_COLORS.length]

        return (
          <Link
            key={key}
            href={`/products?category=${cat.slug}`}
            className={`group border rounded-2xl p-4 text-center hover:shadow-sm transition-all hover:scale-[1.02] ${colorClass}`}
          >
            <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center mx-auto mb-2">
              <Grid3x3 size={14} />
            </div>
            <p className="text-xs font-semibold leading-tight">{cat.name}</p>
          </Link>
        )
      })}
    </div>
  )
}
