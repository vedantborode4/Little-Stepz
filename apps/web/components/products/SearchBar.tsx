"use client"

import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { useDebounce } from "../../hooks/useDebounce"
import { useProductFilterStore } from "../../store/useProductFilterStore"
import { useRouter } from "next/navigation"
import { SearchService } from "../../lib/services/search.service"

export default function SearchBar() {
  const router = useRouter()

  const setFilters = useProductFilterStore((s) => s.setFilters)

  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const wrapperRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(input, 200)


  useEffect(() => {
    const fetch = async () => {
      if (!debouncedSearch) {
        setSuggestions([])
        return
      }

      const res = await SearchService.getSuggestions(debouncedSearch)
      setSuggestions(res)
      setOpen(true)
    }

    fetch()
  }, [debouncedSearch])


  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])


  const goToSearch = (value: string) => {
    const safe = value?.toString().trim()

    if (!safe) return

    setFilters({ search: safe, page: 1 })

    setInput(safe)
    setOpen(false)

    router.push("/products")
  }


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()

    const value =
      activeIndex >= 0
        ? suggestions[activeIndex]?.name || input
        : input

      goToSearch(value)
    }

    if (!suggestions.length) return

    if (e.key === "ArrowDown") {
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    }

    if (e.key === "ArrowUp") {
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0))
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Search className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 p-2  bg-primary text-white rounded-lg" />

      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setActiveIndex(-1)
        }}
        onFocus={() => input && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search toys..."
        className="w-full pl-4 pr-10 py-2 rounded-lg bg-gray-100 text-sm outline-none focus:outline-none focus:ring-0"
      />

      {open && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-md shadow-lg z-50">

          {!suggestions.length && (
            <div className="px-4 py-3 text-sm text-muted">
              No results found
            </div>
          )}

          {suggestions.map((item, index) => (
            <div
              key={item.slug}
              onClick={() => goToSearch(item.name)}
              className={`px-4 py-2 cursor-pointer text-sm ${
                index === activeIndex
                  ? "bg-primary/10"
                  : "hover:bg-gray-50"
              }`}
            >
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}