"use client"

import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

export interface SpecRow {
  label: string
  value: string
}

export default function SpecificationsEditor({
  rows,
  onChange,
  error,
}: {
  rows: SpecRow[]
  onChange: (rows: SpecRow[]) => void
  error?: string
}) {
  const update = (i: number, key: keyof SpecRow, val: string) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  }

  const add = () => onChange([...rows, { label: "", value: "" }])

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    const moved = next.splice(i, 1)[0]
    if (moved) next.splice(j, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <GripVertical size={16} className="text-faint mt-3 hidden sm:block flex-shrink-0" />
              <input
                value={row.label}
                onChange={e => update(i, "label", e.target.value)}
                placeholder="Label (e.g. Material)"
                className="w-1/3 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
              />
              <input
                value={row.value}
                onChange={e => update(i, "value", e.target.value)}
                placeholder="Value (e.g. ABS Plastic)"
                className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
              />
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-2 text-faint hover:text-muted disabled:opacity-30 transition"
                  aria-label="Move up"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  className="p-2 text-faint hover:text-muted disabled:opacity-30 transition"
                  aria-label="Move down"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-2 text-faint hover:text-red-500 transition"
                  aria-label="Remove row"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition"
      >
        <Plus size={15} /> Add specification
      </button>
    </div>
  )
}
