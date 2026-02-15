"use client"

import { Button } from "@repo/ui/index"
import type { Product } from "../../../types/product"

export default function AddToCartSection({ product }: { product: Product }) {
  return (
    <Button disabled={!product.inStock} className="w-full h-12 text-lg">
      ADD TO CART
    </Button>
  )
}
