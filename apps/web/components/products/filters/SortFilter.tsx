"use client"

import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function SortFilter() {
  const { sort, setFilters } = useProductFilterStore()

  return (
    <select
      value={sort || ""}
      onChange={(e) => setFilters({ sort: e.target.value })}
      className="w-full border rounded-lg h-11 px-3 text-sm"
    >
      <option value="">Default</option>
      <option value="price_asc">Price Low → High</option>
      <option value="price_desc">Price High → Low</option>
      <option value="newest">Newest</option>
    </select>
  )
}
