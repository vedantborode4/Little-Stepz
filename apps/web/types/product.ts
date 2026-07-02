export interface ProductImage {
  id: string
  url: string
  alt?: string | null
}

export interface ProductSpecification {
  label: string
  value: string
}

export interface Category {
  id: string
  name: string
  slug: string
}

export type PriceDisplay = "BOTH" | "REGULAR" | "SALE"

export interface Variant {
  id: string
  name: string
  price: string | null
  salePrice?: string | null
  isOnSale?: boolean
  stock: number
  images?: ProductImage[]
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  longDescription?: string | null
  price: string
  salePrice?: string | null
  isOnSale?: boolean
  priceDisplay?: PriceDisplay
  quantity: number
  inStock: boolean
  specifications?: ProductSpecification[] | null
  preOrderEnabled?: boolean
  bookingAmount?: string | null
  preOrderLimit?: number | null
  preOrderCount?: number
  preOrderNote?: string | null
  category: Category
  images: ProductImage[]
  variants: Variant[]
  createdAt: string
  updatedAt: string
}
