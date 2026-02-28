"use client"

import { useEffect, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { AdminCategoryService, AdminCategory } from "../../../lib/services/admin-category.service"

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function CategoryTreeSelect({ value, onChange }: Props) {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    AdminCategoryService.getAll()
      .then(setCategories)
      .catch(console.error)
  }, [])

  const selected = categories.find(c => c.id === value)

  // Build display name with parent prefix
  const displayName = (c: AdminCategory) => {
    const parent = categories.find(p => p.id === c.parentId)
    return parent ? `${parent.name} › ${c.name}` : c.name
  }

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(p => !p)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(p => !p)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer select-none"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? displayName(selected) : "Select category"}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange("") }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange("") } }}
              className="p-0.5 hover:text-red-500 text-gray-400 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
          <div
            onClick={() => { onChange(""); setOpen(false) }}
            className="px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer"
          >
            No category
          </div>
          {categories.map(c => (
            <div
              key={c.id}
              onClick={() => { onChange(c.id); setOpen(false) }}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 ${c.id === value ? "bg-primary/5 text-primary font-medium" : "text-gray-700"}`}
            >
              {displayName(c)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
