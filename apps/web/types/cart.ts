export interface CartItem {
  id: string
  productId: string
  variantId?: string | null   // ✅ allow null
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: string
    salePrice?: string | null
    isOnSale?: boolean
    priceDisplay?: "BOTH" | "REGULAR" | "SALE"
    images: { url: string }[]
  }
  variant?: {
    id: string
    name: string
    price: string
    salePrice?: string | null
    isOnSale?: boolean
  } | null

  subtotal: number
}
