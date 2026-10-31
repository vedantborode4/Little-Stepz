"use client"

import clsx from "clsx"
import LinkTabs from "@/components/ui/Tabs"

export function AnalyticsTabs() {
  return (
    <LinkTabs
      tabs={[
        { label: "Valuation & projections", href: "/analytics", exact: true },
        { label: "Profit", href: "/analytics/profit" },
      ]}
    />
  )
}

export interface StaticColumn<T> {
  header: string
  cell: (row: T) => React.ReactNode
  align?: "left" | "right"
  className?: string
}

/** A small client-side table for figures already computed on the server (no paging or sorting). */
export function StaticTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show for these filters.",
  footer,
}: {
  columns: StaticColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
  footer?: React.ReactNode
}) {
  if (rows.length === 0) return <p className="text-sm text-muted py-8 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                className={clsx(
                  "px-4 sm:px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-surface-2/50">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={clsx("px-4 sm:px-5 py-2.5 whitespace-nowrap", c.align === "right" && "text-right tabular", c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  )
}

/** Segmented control for switching a view in place. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface overflow-hidden">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "px-3 h-9 text-xs font-medium transition",
            i > 0 && "border-l border-border",
            o.value === value ? "bg-primary text-white" : "text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Margin as text, or a dash where there is nothing to divide by. */
export const marginText = (pct: string | null) => (pct === null ? "—" : `${pct}%`)
