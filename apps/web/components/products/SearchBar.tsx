"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useDebounce } from "../../hooks/useDebounce"
import { useProductFilterStore } from "../../store/useProductFilterStore"

export default function SearchBar() {
  const search = useProductFilterStore((s) => s.search)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const [input, setInput] = useState(search || "")

  // 🔥 1000ms debounce
  const debouncedSearch = useDebounce(input, 1000)

  useEffect(() => {
    setFilters({ search: debouncedSearch })
  }, [debouncedSearch, setFilters])

  return (
    <div className="relative w-full ">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted " />

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search toys..."
        className="w-full pl-10 pr-4 py-2 text-gray-900 rounded-lg border border-border bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}
