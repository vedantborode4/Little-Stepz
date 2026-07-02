"use client"

import * as Dialog from "@radix-ui/react-dialog"
import FilterSection from "./FilterSection"
import CategoryFilter from "./CategoryFilter"
import PriceFilter from "./PriceFilter"
import SortFilter from "./SortFilter"
import { SlidersHorizontal, X } from "lucide-react"
import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function MobileFilterDrawer() {
  const applyDraft = useProductFilterStore((s) => s.applyDraft)

  return (
    <Dialog.Root>
      <Dialog.Trigger className="lg:hidden flex items-center gap-2 border border-gray-200 px-4 h-10 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition bg-white shadow-sm">
        <SlidersHorizontal size={15} className="text-gray-500" />
        Filters
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />

        <Dialog.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] flex flex-col">
          {/* Handle */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
            <h2 className="text-base font-semibold text-gray-900">Filters</h2>
            <Dialog.Close className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-5">
            <FilterSection title="Category">
              <CategoryFilter />
            </FilterSection>

            <FilterSection title="Price Range">
              <PriceFilter />
            </FilterSection>

            <FilterSection title="Sort By">
              <SortFilter />
            </FilterSection>
          </div>

          {/* Apply button */}
          <div className="p-4 border-t border-gray-100 shrink-0 safe-area-pb">
            <Dialog.Close
              onClick={() => applyDraft()}
              className="w-full bg-primary text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              Apply Filters
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
