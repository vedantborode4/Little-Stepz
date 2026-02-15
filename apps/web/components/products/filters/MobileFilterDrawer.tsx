"use client"

import * as Dialog from "@radix-ui/react-dialog"
import FilterSection from "./FilterSection"
import CategoryFilter from "./CategoryFilter"
import PriceFilter from "./PriceFilter"
import SortFilter from "./SortFilter"

export default function MobileFilterDrawer() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="lg:hidden border px-4 h-11 rounded-lg text-sm">
        Filters
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />

        <Dialog.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">

          <h2 className="text-lg font-semibold mb-4">Filters</h2>

          <FilterSection title="Category">
            <CategoryFilter />
          </FilterSection>

          <FilterSection title="Price Range">
            <PriceFilter />
          </FilterSection>

          <FilterSection title="Sort By">
            <SortFilter />
          </FilterSection>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
