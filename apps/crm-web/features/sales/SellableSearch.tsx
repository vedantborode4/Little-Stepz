"use client"

import clsx from "clsx"
import { Loader2, Search } from "lucide-react"
import { forwardRef, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SellableItemDto } from "@repo/crm-schema"
import { controlClass } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatMoney } from "@/lib/format"
import { useDebounced } from "@/lib/use-debounced"
import { searchSellable } from "./api"

interface Props {
  locationId: string
  onPick: (item: SellableItemDto) => void
  autoFocus?: boolean
}

/** Name or SKU search with price and free stock at the location. Enter adds the first match. */
const SellableSearch = forwardRef<HTMLInputElement, Props>(function SellableSearch({ locationId, onPick, autoFocus }, ref) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SellableItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const term = useDebounced(q.trim(), 200)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!term || !locationId) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    searchSellable(term, locationId)
      .then((found) => {
        if (!cancelled) setResults(found)
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [term, locationId])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const pick = (item: SellableItemDto) => {
    onPick(item)
    setQ("")
    setResults([])
  }

  return (
    <div ref={box} className="relative">
      <Search size={16} className="absolute left-3 top-3 text-faint" />
      <input
        ref={ref}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0] && term === q.trim()) {
            e.preventDefault()
            pick(results[0])
          }
        }}
        placeholder="Search item by name or SKU, then Enter"
        aria-label="Search items to sell"
        className={clsx(controlClass, "pl-9")}
      />
      {loading && <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-faint" />}
      {open && term && !loading && (
        <div className="absolute z-30 mt-1 w-full max-h-96 overflow-y-auto bg-surface border border-border rounded-xl shadow-card p-1">
          {results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No active items match “{q}”.</p>}
          {results.map((item) => (
            <button
              key={item.variantId}
              type="button"
              onClick={() => pick(item)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-2"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">
                  {item.productName} — {item.variantName}
                </span>
                <span className="block text-xs font-mono text-faint">{item.sku}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-sm font-semibold tabular">{formatMoney(item.offerPrice ?? item.regularPrice)}</span>
                <span className={clsx("block text-xs tabular", item.available > 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                  {item.available > 0 ? `${item.available} free` : "Out of stock"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

export default SellableSearch
