"use client"

import type { Product } from "../../../types/product"
import QuantitySelector from "./QuantitySelector"
import AddToCartSection from "./AddToCartSection"

export default function ProductInfo({ product }: { product: Product }) {
  const price = Number(product.price)

  return (
    <div className="space-y-5">

      <h1 className="text-2xl font-bold">{product.name}</h1>

      <p className="text-muted">{product.description}</p>

      <div className="flex items-center gap-3">
        <span className="text-primary text-2xl font-bold">
          ₹{price}
        </span>
      </div>

      <p className={product.inStock ? "text-green-600" : "text-red-500"}>
        {product.inStock ? "In Stock" : "Out of Stock"}
      </p>

      <QuantitySelector />

      <AddToCartSection product={product} />

      <div>
        <h3 className="font-semibold">Description</h3>
        <p className="text-sm text-muted mt-2">
          {product.description || "No description available"}
        </p>
      </div>

    </div>
  )
}
