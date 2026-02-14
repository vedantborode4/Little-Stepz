export interface ProductImage {
  id: string
  url: string
  alt?: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Variant {
  id: string
  name: string
  price: string | null
  stock: number
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  price: string
  quantity: number
  inStock: boolean
  category: Category
  images: ProductImage[]
  variants: Variant[]
  createdAt: string
  updatedAt: string
}
