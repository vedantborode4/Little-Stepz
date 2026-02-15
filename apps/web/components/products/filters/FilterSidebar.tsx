import FilterSection from "./FilterSection"
import CategoryFilter from "./CategoryFilter"
import PriceFilter from "./PriceFilter"
import SortFilter from "./SortFilter"

export default function FilterSidebar() {
  return (
    <aside className="hidden lg:block bg-white rounded-xl p-5 shadow-card h-fit">

      <FilterSection title="Category">
        <CategoryFilter />
      </FilterSection>

      <FilterSection title="Price Range">
        <PriceFilter />
      </FilterSection>

      <FilterSection title="Sort By">
        <SortFilter />
      </FilterSection>

    </aside>
  )
}
