export interface CartItem {
  productId: string
  variantId?: string
  quantity: number
  product: {
    name: string
    price: string
    images: { url: string }[]
  }
}
