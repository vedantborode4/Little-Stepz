"use client"

import ProductCard from "../products/ProductCard"
import { Product } from "../../types/product"

export default function BestSellerSlider({
  products,
}: {
  products: Product[]
}) {
  return (
    <section className="container space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

    </section>
  )
}
