export interface Category {
  id: string
  name: string
  slug: string
  image?: string | null
  children?: Category[]
}
