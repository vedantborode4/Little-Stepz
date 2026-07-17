"use client"

import { useEffect, useState } from "react"
import { AdminPnlService, type PnlData, type PnlRange } from "../../../lib/services/admin-pnl.service"
import { formatINR } from "../../../lib/pricing"

const RANGES: { value: PnlRange; label: string; full: string }[] = [
  { value: "today", label: "Today",    full: "Today" },
  { value: "7d",    label: "7 Days",   full: "7 Days" },
  { value: "30d",   label: "30 Days",  full: "30 Days" },
  { value: "6m",    label: "6 Months", full: "6 Months" },
  { value: "year",  label: "Year",     full: "Year" },
  { value: "all",   label: "All Time", full: "All Time" },
]

const inr = (n: number) => formatINR(Math.round(n || 0))

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const W = 480, H = 200
  const pad = { top: 24, right: 8, bottom: 24, left: 8 }
  const w = W - pad.left - pad.right
  const h = H - pad.top - pad.bottom
  const max = Math.max(...data.map(d => d.value), 0)
  const n = Math.max(data.length, 1)
  const slot = w / n
  const barW = slot * 0.55

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((d, i) => {
        const bh = max > 0 ? (d.value / max) * h : 0
        const x = pad.left + i * slot + (slot - barW) / 2
        const y = pad.top + h - bh
        return (
          <g key={i}>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {d.value >= 1000 ? `₹${Math.round(d.value / 1000)}k` : `₹${Math.round(d.value)}`}
              </text>
            )}
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={color} />
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const ZERO_MONTHLY = Array.from({ length: 6 }, () => ({ label: "—", revenue: 0, grossProfit: 0 }))

export default function AdminProfitLossPage() {
  const [range, setRange] = useState<PnlRange>("30d")
  const [data, setData] = useState<PnlData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    AdminPnlService.getPnl(range)
      .then(d => { if (active) setData(d) })
      .catch(e => console.error(e))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range])

  const d = data
  const costPct = Math.round((d?.costRatio ?? 0) * 100)
  const rangeLabel = RANGES.find(r => r.value === range)?.full ?? ""
  const netProfit = d?.netProfit ?? 0
  const netPos = netProfit >= 0
  const monthly = d?.monthly?.length ? d.monthly : ZERO_MONTHLY

  const amount = (n: number) => (loading || !d ? "—" : inr(n))

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Profit &amp; Loss</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Estimated P&amp;L based on {costPct}% cost ratio
          </p>
        </div>
        <div className="bg-surface border border-border rounded-full p-1 flex items-center gap-0.5 overflow-x-auto">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                range === r.value ? "bg-primary text-white" : "text-muted hover:text-text"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="bg-surface border border-border rounded-2xl p-8 sm:p-10 text-center">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-faint">
          Net Profit / Loss ({rangeLabel})
        </p>
        <p className={`mt-3 text-4xl sm:text-5xl font-bold ${netPos ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
          {loading || !d ? "—" : `${netPos ? "+" : "−"}${inr(Math.abs(netProfit))}`}
        </p>
        <p className="mt-3 text-sm text-muted">
          Margin: {((d?.margin ?? 0) * 100).toFixed(1)}% · {d?.orderCount ?? 0} orders
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Total Revenue", value: d?.revenue },
          { label: "GST Liability",  value: d?.gst },
          { label: "Product Cost",   value: d?.productCost },
          { label: "Gross Profit",   value: d?.grossProfit },
          { label: "Commissions",    value: d?.commissions },
          { label: "Discounts",      value: d?.discounts },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-faint">{s.label}</p>
            <p className="mt-1.5 text-lg sm:text-xl font-bold text-text truncate">{amount(s.value ?? 0)}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Breakdown */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <h3 className="font-semibold text-text text-sm sm:text-base mb-4">P&amp;L Breakdown</h3>
          <div className="space-y-3 text-sm">
            <Row label="Revenue (incl. GST)" value={amount(d?.revenue ?? 0)} />
            <Row label="GST Collected (liability)" value={loading || !d ? "—" : `−${inr(d.gst)}`} color="text-amber-600 dark:text-amber-400" />
            <Row label="Taxable Revenue" value={amount(d?.taxable ?? 0)} />
            <Row
              label={`Product Cost (${d?.hasActualCosts ? "actual" : `est. ${costPct}%`})`}
              value={loading || !d ? "—" : `−${inr(d.productCost)}`}
              color="text-red-500 dark:text-red-400"
            />
            <Row label="Gross Profit" value={amount(d?.grossProfit ?? 0)} color="text-blue-600 dark:text-blue-400" />
            <Row label="Shipping Cost (est.)" value={loading || !d ? "—" : `−${inr(d.shippingCost)}`} color="text-red-500 dark:text-red-400" />
            <Row label="Affiliate Commissions" value={loading || !d ? "—" : `−${inr(d.commissions)}`} color="text-purple-600 dark:text-purple-400" />
            <Row label="Discounts Given" value={loading || !d ? "—" : `−${inr(d.discounts)}`} color="text-red-500 dark:text-red-400" />
            <div className="border-t border-border pt-3">
              <Row
                label="Net Profit (est.)"
                value={loading || !d ? "—" : `${netPos ? "+" : "−"}${inr(Math.abs(netProfit))}`}
                color={netPos ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}
                bold
              />
            </div>
          </div>
          <p className="text-xs text-faint mt-4 leading-relaxed">
            Product cost is estimated at {costPct}% of taxable value
            {d?.hasActualCosts ? " where an actual cost isn't set" : ""}. Shipping cost estimated at{" "}
            {inr(d?.shippingPerOrder ?? 0)}/order. For exact P&amp;L, enter actual purchase costs in the Products table.
          </p>
        </div>

        {/* Charts */}
        <div className="space-y-4 sm:space-y-5">
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
            <h3 className="font-semibold text-text text-sm sm:text-base mb-2">Monthly Revenue (6 months)</h3>
            {loading && !d
              ? <div className="h-40 bg-surface-2 animate-pulse rounded-xl" />
              : <BarChart data={monthly.map(m => ({ label: m.label, value: m.revenue }))} color="#2563EB" />}
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
            <h3 className="font-semibold text-text text-sm sm:text-base mb-2">Monthly Gross Profit</h3>
            {loading && !d
              ? <div className="h-40 bg-surface-2 animate-pulse rounded-xl" />
              : <BarChart data={monthly.map(m => ({ label: m.label, value: m.grossProfit }))} color="#16A34A" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, color = "text-text", bold = false }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-muted ${bold ? "font-semibold text-text" : ""}`}>{label}</span>
      <span className={`${color} ${bold ? "font-bold" : "font-medium"} tabular-nums`}>{value}</span>
    </div>
  )
}
