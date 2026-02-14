import { ReadonlyURLSearchParams } from "next/navigation"

export const parseQuery = (params: ReadonlyURLSearchParams) => ({
  page: Number(params.get("page") || 1),
  category: params.get("category") || undefined,
  sort: params.get("sort") || undefined,
  search: params.get("search") || undefined,
})

export const buildQuery = (filters: Record<string, any>) => {
  const query = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value))
    }
  })

  return query.toString()
}
