"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useProductFilterStore } from "../../store/useProductFilterStore"

interface PaginationProps {
  totalPages: number
  currentPage?: number
  onPageChange?: (page: number) => void
}

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
}: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const storePage = useProductFilterStore((s) => s.page)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const activePage = currentPage ?? storePage

  if (totalPages <= 1) return null

  const changePage = (page: number) => {
    if (onPageChange) {
      onPageChange(page) // ✅ category mode
      return
    }

    // ✅ products page mode (existing behaviour)
    setFilters({ page })

    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))

    router.replace(`/products?${params.toString()}`, {
      scroll: false,
    })
  }

  return (
    <div className="flex justify-center mt-10 gap-2 flex-wrap">
      {Array.from({ length: totalPages }).map((_, i) => {
        const page = i + 1

        return (
          <button
            key={page}
            onClick={() => changePage(page)}
            className={`px-4 py-2 rounded-lg text-sm border transition
              ${
                activePage === page
                  ? "bg-primary text-white border-primary"
                  : "bg-white hover:bg-gray-50"
              }
            `}
          >
            {page}
          </button>
        )
      })}
    </div>
  )
}