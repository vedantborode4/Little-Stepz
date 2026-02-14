export interface ProductImage {
  id: string
  url: string
  alt?: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: string
  quantity: number
  inStock: boolean
  images: ProductImage[]
  categoryId: string
}
