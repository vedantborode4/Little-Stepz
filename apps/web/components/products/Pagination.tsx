"use client"

import { useProductFilterStore } from "../../store/useProductFilterStore"

export  function Pagination({ totalPages }: { totalPages: number }) {
  const { page, setFilter } = useProductFilterStore()

  return (
    <div className="flex justify-center gap-2 mt-10">
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          onClick={() => setFilter({ page: i + 1 })}
          className={`px-4 py-2 rounded ${
            page === i + 1
              ? "bg-primary text-white"
              : "bg-gray-100"
          }`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}
