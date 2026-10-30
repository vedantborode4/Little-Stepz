"use client"

import { ArrowDownLeft, ArrowUpRight, Briefcase, User } from "lucide-react"
import { useState } from "react"
import { PAYMENT_METHOD_LABELS, SALES_CHANNEL_LABELS } from "@repo/crm-schema"
import { Card, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import { formatMoney, todayIST } from "@/lib/format"
import { useCollections } from "./api"
import { PaymentTabs } from "./shared"

function th(label: string, right = false) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  )
}

export default function Collections() {
  const [from, setFrom] = useState(todayIST())
  const [to, setTo] = useState(todayIST())
  const { data, isLoading } = useCollections({ from, to })

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Money collected by method and account. Transfers between accounts are shown but never counted as received."
      />
      <PaymentTabs />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Input type="date" aria-label="From date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="py-2" />
        </div>
        <span className="text-muted text-sm">to</span>
        <div className="w-40">
          <Input type="date" aria-label="To date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="py-2" />
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <StatCard
              title="Received"
              value={formatMoney(data.totals.received)}
              hint={`${data.totals.payments} payments`}
              icon={<ArrowDownLeft size={18} />}
              color="bg-green-50 dark:bg-green-500/15 text-green-600"
            />
            <StatCard
              title="Refunded"
              value={formatMoney(data.totals.refunded)}
              hint={`Net ${formatMoney(data.totals.net)}`}
              icon={<ArrowUpRight size={18} />}
              color="bg-red-50 dark:bg-red-500/15 text-red-500"
            />
            <StatCard
              title="Business accounts"
              value={formatMoney(data.business)}
              hint={`Fees ${formatMoney(data.totals.fees)} · net of fees ${formatMoney(data.totals.netAfterFees)}`}
              icon={<Briefcase size={18} />}
            />
            <StatCard
              title="Personal accounts"
              value={formatMoney(data.personal)}
              hint="Business money received personally"
              icon={<User size={18} />}
              color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
            />
          </div>

          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">By account</h2>
            </div>
            {data.byAccount.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No money moved in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2">
                    <tr>
                      {th("Account")}
                      {th("Received", true)}
                      {th("Refunded", true)}
                      {th("Fees", true)}
                      {th("Transfers in", true)}
                      {th("Transfers out", true)}
                      {th("Movement", true)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byAccount.map((a) => (
                      <tr key={a.accountId} className="border-t border-border">
                        <td className="px-4 py-3 min-w-44">
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-faint">
                            {PAYMENT_METHOD_LABELS[a.method]}
                            {a.isPersonal && " · personal"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular">{formatMoney(a.received)}</td>
                        <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(a.refunded)}</td>
                        <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(a.fees)}</td>
                        <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(a.transfersIn)}</td>
                        <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(a.transfersOut)}</td>
                        <td className="px-4 py-3 text-right tabular font-semibold">{formatMoney(a.movement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-start">
            <Card title="By method">
              <ul className="space-y-2 text-sm">
                {data.byMethod.length === 0 && <li className="text-muted">Nothing yet.</li>}
                {data.byMethod.map((m) => (
                  <li key={m.method} className="flex justify-between">
                    <span>
                      {PAYMENT_METHOD_LABELS[m.method]} <span className="text-xs text-faint">({m.count})</span>
                    </span>
                    <span className="tabular font-medium">{formatMoney(m.net)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="By sales channel">
              <ul className="space-y-2 text-sm">
                {data.byChannel.length === 0 && <li className="text-muted">Nothing yet.</li>}
                {data.byChannel.map((c) => (
                  <li key={c.channel ?? "credit"} className="flex justify-between">
                    <span>{c.channel ? SALES_CHANNEL_LABELS[c.channel] : "Held as customer credit"}</span>
                    <span className="tabular font-medium">{formatMoney(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
