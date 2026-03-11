"use client"

import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function SortFilter() {
  const { sort, setFilters } = useProductFilterStore()

  return (
    <select
      value={sort || ""}
      onChange={(e) => setFilters({ sort: e.target.value || undefined, page: 1 })}
      className="w-full border border-gray-200 rounded-lg h-11 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
    >
      <option value="">Default (Newest)</option>
      <option value="price_asc">Price: Low → High</option>
      <option value="price_desc">Price: High → Low</option>
      <option value="newest">Newest First</option>
      <option value="name_asc">Name: A → Z</option>
      <option value="name_desc">Name: Z → A</option>
    </select>
  )
}
