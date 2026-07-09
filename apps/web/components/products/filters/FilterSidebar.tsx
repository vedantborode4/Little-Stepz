"use client"

import FilterSection from "./FilterSection"
import CategoryFilter from "./CategoryFilter"
import PriceFilter from "./PriceFilter"
import SortFilter from "./SortFilter"
import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function FilterSidebar() {
  const applyDraft = useProductFilterStore((s) => s.applyDraft)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const clear = () =>
    setFilters({ sort: undefined, priceMin: undefined, priceMax: undefined, page: 1 })

  return (
    <aside className="hidden lg:block bg-surface-2 rounded-xl p-5  h-fit">

      <FilterSection title="Category">
        <CategoryFilter />
      </FilterSection>

      <FilterSection title="Price Range">
        <PriceFilter />
      </FilterSection>

      <FilterSection title="Sort By">
        <SortFilter />
      </FilterSection>

      {/* Price & Sort apply together only on submit */}
      <div className="mt-4 space-y-2">
        <button
          onClick={() => applyDraft()}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          Apply Filters
        </button>
        <button
          onClick={clear}
          className="w-full bg-surface border border-border text-muted py-2.5 rounded-xl text-sm font-medium hover:bg-surface-2 transition"
        >
          Clear
        </button>
      </div>

    </aside>
  )
}
