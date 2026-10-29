"use client"

import { Download, Loader2, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ExportFormat } from "@repo/crm-schema"
import { errorMessage } from "@/lib/api-error"
import { controlClass } from "./Form"
import clsx from "clsx"

const SEARCH_DEBOUNCE_MS = 400

export function SearchInput({ value, onChange, placeholder = "Search…" }: { value?: string; onChange: (q: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value ?? "")
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (text === (value ?? "")) return
    const id = setTimeout(() => onChangeRef.current(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text, value])

  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(controlClass, "pl-9 py-2")}
      />
      {text && (
        <button aria-label="Clear search" onClick={() => setText("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-text">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ value, onChange, children, label }: { value?: string; onChange: (v: string | undefined) => void; children: React.ReactNode; label: string }) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="border border-border text-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
    >
      {children}
    </select>
  )
}

export function ExportMenu({ onExport }: { onExport: (format: ExportFormat) => Promise<void> }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  const run = async (format: ExportFormat) => {
    setBusy(format)
    try {
      await onExport(format)
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="inline-flex rounded-xl border border-border bg-surface overflow-hidden">
      {(["csv", "xlsx"] as const).map((format, i) => (
        <button
          key={format}
          onClick={() => run(format)}
          disabled={busy !== null}
          className={clsx("inline-flex items-center gap-1.5 px-3 h-10 text-xs text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50", i > 0 && "border-l border-border")}
          title={`Export all matching rows as ${format.toUpperCase()}`}
        >
          {busy === format ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {format === "csv" ? "CSV" : "Excel"}
        </button>
      ))}
    </div>
  )
}

/** Search + filters on the left, actions on the right; stacks on phones. */
export function ListToolbar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
