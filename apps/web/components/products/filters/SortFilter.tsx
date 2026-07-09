"use client"

import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function SortFilter() {
  const draftSort = useProductFilterStore((s) => s.draftSort)
  const setDraft = useProductFilterStore((s) => s.setDraft)

  return (
    <select
      value={draftSort || ""}
      onChange={(e) => setDraft({ draftSort: e.target.value || undefined })}
      className="w-full border border-border rounded-lg h-11 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
    >
      <option value="">Default (Newest)</option>
      <option value="price_asc">Price: Low → High</option>
      <option value="price_desc">Price: High → Low</option>
      <option value="newest">Newest First</option>
      <option value="name_asc">Name: A → Z</option>
      <option value="name_desc">Name: Z → A</option>
    </select>
  )
}
