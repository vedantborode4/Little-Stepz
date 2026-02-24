"use client"

import Link from "next/link"
import { useCategoryStore } from "../../store/useCategoryStore"
import type { Product } from "../../types/product"

interface Props {
  product?: Product
}

export default function Breadcrumbs({ product }: Props) {
  const categoryPath = useCategoryStore((s) => s.categoryPath)

  return (
    <div className="text-sm text-muted flex items-center gap-2 flex-wrap">
      <Link href="/" className="hover:text-primary">Home</Link>
      <span>/</span>

      <Link href="/products" className="hover:text-primary">Products</Link>

      {categoryPath.map((cat) => (
        <div key={cat.id} className="flex items-center gap-2">
          <span>/</span>
          <Link
            href={`/products/category/${cat.slug}`}
            className="hover:text-primary"
          >
            {cat.name}
          </Link>
        </div>
      ))}

      {product && (
        <>
          <span>/</span>
          <span className="text-primary font-medium">
            {product.name}
          </span>
        </>
      )}
    </div>
  )
}