
import Link from "next/link"
import type { Category } from "../../types/category"

interface Props {
  categories: Category[]
}

export default function CategoryGrid({ categories }: Props) {
  if (!categories?.length) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
      {categories.map((cat, index) => {
        const key = cat.id || cat.slug || `cat-${index}`

        return (
          <Link
            key={key}
            href={`/products?category=${cat.slug}`}
            className="group border rounded-xl p-4 text-center hover:shadow-sm transition"
          >
            <div className="font-medium">{cat.name}</div>
          </Link>
        )
      })}
    </div>
  )
}