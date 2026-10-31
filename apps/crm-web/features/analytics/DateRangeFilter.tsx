"use client"

import clsx from "clsx"
import { Input } from "@/components/ui/Form"
import { addDays, todayIST } from "@/lib/format"

export interface DateRange {
  from: string
  to: string
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: todayIST(), to: todayIST() }) },
  { label: "7 days", range: () => ({ from: addDays(todayIST(), -6), to: todayIST() }) },
  { label: "30 days", range: () => ({ from: addDays(todayIST(), -29), to: todayIST() }) },
  { label: "This month", range: () => ({ from: `${todayIST().slice(0, 8)}01`, to: todayIST() }) },
  { label: "This FY", range: () => ({ from: financialYearStart(todayIST()), to: todayIST() }) },
]

/** Indian financial year: 1 April to 31 March. */
function financialYearStart(today: string) {
  const year = Number(today.slice(0, 4))
  return Number(today.slice(5, 7)) >= 4 ? `${year}-04-01` : `${year - 1}-04-01`
}

export const monthToDate = (): DateRange => PRESETS[3]!.range()

/** Preset chips plus a custom from/to, in one row that wraps on phones. */
export default function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  // Presets can cover the same days (on the 30th, "30 days" is "This month"); highlight only the first.
  const activePreset = PRESETS.findIndex((p) => {
    const r = p.range()
    return r.from === value.from && r.to === value.to
  })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface overflow-hidden">
        {PRESETS.map((p, i) => {
          const r = p.range()
          const active = i === activePreset
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(r)}
              aria-pressed={active}
              className={clsx(
                "px-3 h-9 text-xs font-medium transition",
                i > 0 && "border-l border-border",
                active ? "bg-primary text-white" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-36">
          <Input
            type="date"
            aria-label="From date"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            className="py-1.5"
          />
        </div>
        <span className="text-muted text-sm">to</span>
        <div className="w-36">
          <Input
            type="date"
            aria-label="To date"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            className="py-1.5"
          />
        </div>
      </div>
    </div>
  )
}
