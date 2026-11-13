"use client"

import { HandCoins, Link2Off, Wallet } from "lucide-react"
import { useState } from "react"
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import { ListToolbar } from "@/components/ui/Toolbar"
import { formatDate, formatMoney, todayIST } from "@/lib/format"
import { useMyCommission } from "./api"

const cell = "px-3 py-2 text-sm"
const head = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"

/** A salesperson's own commission: what each sale earned, what was paid, and what's still owed. Never profit or costs. */
export default function MyCommissionPage() {
  const [period, setPeriod] = useState(() => ({ from: `${todayIST().slice(0, 7)}-01`, to: todayIST() }))
  const { data, isLoading } = useMyCommission(period)
  const t = data?.totals
  const owed = Number(t?.owed ?? 0)
  const show = (value: string | number | undefined) => (t ? formatMoney(value ?? 0) : "—")

  if (data && !data.salesperson) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <PageHeader title="My Commission" />
        <Card>
          <EmptyState
            icon={<Link2Off size={22} />}
            title="Your login isn't linked to a salesperson"
            hint="Ask an admin to link it in Settings → Salespeople. Your commission then shows here."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="My Commission"
        subtitle={
          data?.salesperson
            ? `${data.salesperson.name} (${data.salesperson.staffCode}) · ${data.salesperson.commissionRate}% commission. Counted when a sale is handed over or dispatched; returns take it back.`
            : undefined
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          title="Earned"
          value={show(t?.net)}
          hint={t ? `In the period, after returns (${t.sales} sales)` : "In the period, after returns"}
          icon={<HandCoins size={18} />}
        />
        <StatCard title="Paid to you" value={show(t?.paid)} hint="In the period" icon={<Wallet size={18} />} />
        <StatCard title={owed < 0 ? "Paid in advance" : "Still owed to you"} value={show(Math.abs(owed))} hint="All time" />
      </div>
      <Card>
        <ListToolbar>
          <div className="flex gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))}
              className="py-2 sm:w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              value={period.to}
              min={period.from}
              onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))}
              className="py-2 sm:w-40"
            />
          </div>
        </ListToolbar>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-2">
              <tr>
                <th className={`${head} text-left`}>Date</th>
                <th className={`${head} text-left`}>Sale</th>
                <th className={`${head} text-right`}>Rate</th>
                <th className={`${head} text-right`}>Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!isLoading && data?.entries.length === 0 && (
                <tr>
                  <td colSpan={4} className={`${cell} text-center text-faint py-6`}>
                    No commission in these dates
                  </td>
                </tr>
              )}
              {data?.entries.map((e) => (
                <tr key={`${e.orderCode}-${e.returnCode ?? "sale"}`}>
                  <td className={`${cell} whitespace-nowrap`}>{formatDate(e.date)}</td>
                  <td className={cell}>
                    <span className="font-mono text-xs whitespace-nowrap">{e.orderCode}</span>
                    {e.returnCode && (
                      <span className="ml-2">
                        <Badge tone="yellow">Return {e.returnCode}</Badge>
                      </span>
                    )}
                  </td>
                  <td className={`${cell} text-right tabular`}>{e.rate}%</td>
                  <td className={`${cell} text-right tabular font-medium`}>{formatMoney(e.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {data && data.payouts.length > 0 && (
        <Card title="Payments to you in these dates">
          <ul className="divide-y divide-border">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {formatDate(p.businessDate)}
                  {p.reference && <span className="text-muted"> · {p.reference}</span>}
                  {Number(p.amount) < 0 && <span className="text-faint"> · cancelled payment</span>}
                </span>
                <span className="tabular font-medium">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
