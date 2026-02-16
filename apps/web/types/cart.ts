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
    images: { url: string }[]
  }
  variant?: {
    id: string
    name: string
    price: string
  } | null

  subtotal: number
}
