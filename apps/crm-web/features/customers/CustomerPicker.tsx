"use client"

import clsx from "clsx"
import { Loader2, Search, UserPlus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { CustomerListItemDto } from "@repo/crm-schema"
import { controlClass } from "@/components/ui/Form"
import { useDebounced } from "@/lib/use-debounced"
import { useCustomers } from "./api"
import { CustomerTypeBadge } from "./shared"

interface Props {
  onPick: (customer: CustomerListItemDto) => void
  excludeId?: string
  /** Offers "add new" with whatever was typed (a number or a name). */
  onCreate?: (typed: string) => void
  /** Also shows "add new" as a button inside the field, so it's there before anything is typed. */
  addButton?: boolean
  placeholder?: string
  autoFocus?: boolean
}

/** Find a customer by full mobile number, the last four digits, name, code or city. */
export default function CustomerPicker({ onPick, excludeId, onCreate, addButton, placeholder, autoFocus }: Props) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const term = useDebounced(q.trim(), 250)
  const { data, isFetching } = useCustomers({ q: term, limit: 8 }, term.length > 0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const results = (term ? (data?.items ?? []) : []).filter((c) => c.id !== excludeId)
  const create = () => {
    onCreate?.(q.trim())
    setQ("")
    setOpen(false)
  }
  const inlineAdd = Boolean(addButton && onCreate)

  return (
    <div ref={box} className="relative">
      {inlineAdd ? (
        <button
          type="button"
          onClick={create}
          aria-label="Add new customer"
          title="Add new customer"
          className="absolute left-1.5 top-1.5 p-1.5 rounded-lg text-primary hover:bg-primary/10 transition"
        >
          <UserPlus size={16} />
        </button>
      ) : (
        <Search size={15} className="absolute left-3 top-3 text-faint" />
      )}
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? "Mobile number, last 4 digits, name or code"}
        aria-label="Search customers"
        className={clsx(controlClass, inlineAdd ? "pl-11 pr-9" : "pl-9")}
      />
      {isFetching ? (
        <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-faint" />
      ) : (
        inlineAdd && <Search size={15} className="absolute right-3 top-3 text-faint pointer-events-none" />
      )}
      {open && q.trim() && term === q.trim() && !isFetching && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-card p-1">
          {results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No customer matches “{q}”.</p>}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c)
                setQ("")
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-2"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{c.name}</span>
                <span className="block text-xs text-faint">
                  <span className="font-mono">{c.code}</span>
                  {[c.mobile, c.city].filter(Boolean).map((v) => ` · ${v}`)}
                </span>
              </span>
              <CustomerTypeBadge type={c.type} />
            </button>
          ))}
          {onCreate && (
            <button
              type="button"
              onClick={create}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-primary hover:bg-primary/5 border-t border-border mt-1"
            >
              <UserPlus size={14} className="shrink-0" />
              <span className="text-sm">Add “{q.trim()}” as a new customer</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
