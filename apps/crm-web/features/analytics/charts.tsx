"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts"
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format"

const axisTick = { fill: "var(--color-faint)", fontSize: 11 }

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-card text-xs">
      <p className="text-muted">{formatDate(String(label))}</p>
      <p className="text-text font-semibold tabular mt-0.5">{formatMoney(payload[0]!.value ?? 0)}</p>
    </div>
  )
}

/** One series over time: a 2px line with a faint fill, a crosshair and the day's figure on hover. */
export function TrendChart({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  return (
    <div className="h-56 sm:h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tickFormatter={(d: string) =>
              new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
            }
            minTickGap={24}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={formatMoneyCompact} allowDecimals={false} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--color-faint)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#trend-fill)"
            activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface BarListRow {
  key: string
  label: string
  value: number
  display: string
  hint?: string
}

/** Ranked magnitudes as labelled horizontal bars: one hue, the value printed beside each bar. */
export function BarList({ rows, empty = "Nothing in this period yet." }: { rows: BarListRow[]; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  if (rows.length === 0 || max <= 0) return <p className="text-sm text-muted py-6 text-center">{empty}</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${r.display}${r.hint ? ` · ${r.hint}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-text truncate">{r.label}</span>
            <span className="text-text font-semibold tabular shrink-0">{r.display}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/80 group-hover:bg-primary transition-colors"
              style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
            />
          </div>
          {r.hint && <p className="text-xs text-faint mt-1">{r.hint}</p>}
        </li>
      ))}
    </ul>
  )
}
