"use client"

import { useProductFilterStore } from "../../store/useProductFilterStore"

export const Pagination = ({ totalPages }: { totalPages: number }) => {
  const { page, setFilters } = useProductFilterStore()

  return (
    <div className="flex justify-center mt-10 gap-2">

      {Array.from({ length: totalPages }).map((_, i) => {
        const p = i + 1

        return (
          <button
            key={p}
            onClick={() => setFilters({ page: p })}
            className={`px-4 h-10 rounded-lg border text-sm
              ${page === p
                ? "bg-primary text-white border-primary"
                : "bg-white hover:bg-gray-50"}
            `}
          >
            {p}
          </button>
        )
      })}

    </div>
  )
}
