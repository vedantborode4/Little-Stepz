import { ProductFilterValues } from "../../store/useProductFilterStore"

export const buildProductQuery = (filters: ProductFilterValues) => {
  const params = new URLSearchParams()

  params.set("page", String(filters.page))

  if (filters.category) params.set("category", filters.category)
  if (filters.sort)     params.set("sort", filters.sort)
  if (filters.search)   params.set("search", filters.search)
  if (filters.priceMin) params.set("priceMin", String(filters.priceMin))
  if (filters.priceMax) params.set("priceMax", String(filters.priceMax))

  return params.toString()
}
