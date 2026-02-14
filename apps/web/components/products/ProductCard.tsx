"use client"

import Image from "next/image"
import { Product } from "../../types/product"
import { useCartStore } from "../../store/useCartStore"

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)

  return (
    <div className="bg-white rounded-xl shadow-card p-3 flex flex-col">

      <div className="relative w-full h-48">
        <Image
          src={product.images[0]?.url || "/placeholder.png"}
          alt={product.name}
          fill
          className="object-contain"
        />
      </div>

      <h3 className="text-sm font-medium mt-3 line-clamp-2">
        {product.name}
      </h3>

      <p className="text-primary font-bold mt-1">₹{product.price}</p>

      <button
        onClick={() =>
          addItem({
            productId: product.id,
            quantity: 1,
          })
        }
        className="mt-auto bg-primary text-white py-2 rounded-lg"
      >
        Add to Cart
      </button>
    </div>
  )
}
