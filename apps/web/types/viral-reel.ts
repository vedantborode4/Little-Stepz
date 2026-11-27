import type { Product } from "./product"

export interface ViralReel {
  id: string
  reelUrl: string
  coverImageUrl: string
  caption: string | null
  /** Live products only, in the admin's order. Never empty. */
  products: Product[]
}
