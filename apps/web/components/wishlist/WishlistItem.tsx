"use client"

import Image from "next/image"
import { toast } from "sonner"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"

export default function WishlistItem({ item, onRemoved }: any) {
  const addItem = useCartStore((s) => s.addItem)
  const toggle = useWishlistStore((s) => s.toggle)

  const image = item.product.images?.[0]?.url || "/placeholder.png"

  const handleAddToCart = async () => {
    await addItem({
      productId: item.product.id,
      quantity: 1,
    })

    toast.success("Added to cart")
  }

  const handleRemove = async () => {
    await toggle(item.product.id) // keeps global state correct
    onRemoved?.()
    toast.success("Removed from wishlist")
  }

  return (
    <div className="flex items-center justify-between py-5 border-b last:border-none">

      <div className="flex gap-4 items-center">

        <div className="relative w-16 h-16 bg-gray-50 rounded-lg overflow-hidden">
          <Image
            src={image}
            alt={item.product.name}
            fill
            className="object-contain"
          />
        </div>

        <div>
          <h3 className="font-medium leading-tight">
            {item.product.name}
          </h3>

          <p className="text-sm text-muted">
            {item.product.brand?.name}
          </p>

          <p className="font-semibold mt-1">
            ₹{item.product.price}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">

        <button
          onClick={handleAddToCart}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Add to cart
        </button>

        <button
          onClick={handleRemove}
          className="text-sm text-muted hover:text-red-500 transition"
        >
          Remove
        </button>

      </div>
    </div>
  )
}
