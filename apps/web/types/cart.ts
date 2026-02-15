export interface CartItem {
  id: string
  productId: string
  variantId?: string
  quantity: number
  subtotal: number

  product: {
    id: string
    name: string
    slug: string
    price: number
    images: { url: string }[]
  }

  variant?: {
    id: string
    name: string
    price: number
  }

  isOptimistic?: boolean
}
