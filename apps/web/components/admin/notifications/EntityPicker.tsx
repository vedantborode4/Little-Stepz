"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X, Check } from "lucide-react"
import {
  AdminNotificationService,
  type TargetSearchKind,
  type TargetSearchResult,
} from "../../../lib/services/admin-notification.service"

interface Props {
  kind: TargetSearchKind
  label: string
  value: TargetSearchResult | null
  onChange: (v: TargetSearchResult | null) => void
}

export default function EntityPicker({ kind, label, value, onChange }: Props) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<TargetSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced search; also runs once on focus with an empty query (recent items).
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await AdminNotificationService.searchTargets(kind, q)
        if (alive) setResults(res)
      } catch {
        if (alive) setResults([])
      } finally {
        if (alive) setLoading(false)
      }
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, kind, open])

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  if (value) {
    return (
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">{label}</label>
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-primary bg-primary/5">
          <Check size={15} className="text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text truncate">{value.label}</p>
            {value.sublabel && <p className="text-xs text-faint truncate">{value.sublabel}</p>}
          </div>
          <button type="button" onClick={() => onChange(null)} className="p-1 text-faint hover:text-text shrink-0">
            <X size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-medium text-text mb-1.5">{label}</label>
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 focus-within:ring-2 focus-within:ring-primary/30">
        <Search size={15} className="text-faint shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${kind}s…`}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-faint focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
          {loading ? (
            <p className="px-3.5 py-3 text-sm text-faint">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-faint">No matches</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange(r); setOpen(false); setQ("") }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-surface-2 transition"
              >
                <p className="text-sm text-text truncate">{r.label}</p>
                {r.sublabel && <p className="text-xs text-faint truncate">{r.sublabel}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
