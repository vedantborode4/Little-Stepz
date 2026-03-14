import FilterSection from "./FilterSection"
import CategoryFilter from "./CategoryFilter"
import PriceFilter from "./PriceFilter"
import SortFilter from "./SortFilter"

export default function FilterSidebar() {
  return (
    <aside className="hidden lg:block bg-[#F6F6F6] rounded-xl p-5  h-fit">

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
