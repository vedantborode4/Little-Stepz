"use client"

import clsx from "clsx"
import { Layers, Loader2, Plus, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ProductDetailDto, VariantSearchResultDto } from "@repo/crm-schema"
import { controlClass } from "@/components/ui/Form"
import { getData } from "@/lib/api-client"
import { errorMessage } from "@/lib/api-error"
import { searchVariants } from "./api"

export interface PickedVariant {
  variantId: string
  sku: string
  label: string
}

const SEARCH_DELAY_MS = 250

/** Search by SKU or name; add one variant, or every active variant of its product (e.g. all colours). */
export default function VariantPicker({ onPick, excludeIds }: { onPick: (variants: PickedVariant[]) => void; excludeIds: Set<string> }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<VariantSearchResultDto[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults([])
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      setLoading(true)
      try {
        const found = await searchVariants(term)
        if (!cancelled) setResults(found)
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [q])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const pickOne = (v: VariantSearchResultDto) => {
    onPick([{ variantId: v.id, sku: v.sku, label: `${v.productName} — ${v.name}` }])
    setQ("")
    setOpen(false)
  }

  const pickProduct = async (productId: string) => {
    try {
      const product = await getData<ProductDetailDto>(`/products/${productId}`)
      onPick(
        product.variants
          .filter((v) => v.status === "ACTIVE")
          .map((v) => ({ variantId: v.id, sku: v.sku, label: `${product.name} — ${v.name}` })),
      )
      setQ("")
      setOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const productIds = new Set(results.map((r) => r.productId))

  return (
    <div ref={box} className="relative">
      <Search size={15} className="absolute left-3 top-3 text-faint" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Add an item — search by product name or SKU"
        aria-label="Search items to add"
        className={clsx(controlClass, "pl-9")}
      />
      {loading && <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-faint" />}
      {open && q.trim() && !loading && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-card p-1">
          {results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No active items match “{q}”.</p>}
          {results.map((v) => {
            const added = excludeIds.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                disabled={added}
                onClick={() => pickOne(v)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-2 disabled:opacity-40"
              >
                <Plus size={14} className="text-faint shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {v.productName} — {v.name}
                  </span>
                  <span className="block text-xs font-mono text-faint">{v.sku}</span>
                </span>
                {added && <span className="text-[10px] text-faint">added</span>}
              </button>
            )
          })}
          {[...productIds].map((productId) => {
            const first = results.find((r) => r.productId === productId)!
            return (
              <button
                key={`p-${productId}`}
                type="button"
                onClick={() => pickProduct(productId)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-primary hover:bg-primary/5 border-t border-border mt-1"
              >
                <Layers size={14} className="shrink-0" />
                <span className="text-sm">Add every variant of {first.productName}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
