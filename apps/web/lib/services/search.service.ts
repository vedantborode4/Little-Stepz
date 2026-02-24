import { api } from "../api-client"

export const SearchService = {
  async getSuggestions(query: string) {
    if (!query) return []

    const { data } = await api.get("/products/search/suggestions", {
      params: { q: query },
    })

    return data?.data?.suggestions || []
  },
}