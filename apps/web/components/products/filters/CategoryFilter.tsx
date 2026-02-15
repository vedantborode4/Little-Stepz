"use client"

import { useProductFilterStore } from "../../../store/useProductFilterStore"

const categories = [
  { label: "Action Figures", value: "action-figures" },
  { label: "Cars & Vehicle Playsets", value: "cars" },
  { label: "Soft Toys", value: "soft-toys" },
]

export default function CategoryFilter() {
  const { category, setFilters } = useProductFilterStore()

  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <label key={c.value} className="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            checked={category === c.value}
            onChange={() =>
              setFilters({
                category: category === c.value ? undefined : c.value,
              })
            }
          />
          {c.label}
        </label>
      ))}
    </div>
  )
}
