export interface CartItem {
  id: string

  productId: string
  variantId?: string | null
  quantity: number

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
  } | null

  subtotal: number
}
