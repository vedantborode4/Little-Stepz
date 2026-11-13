"use client"

import type { ColumnDef } from "@tanstack/react-table"
import clsx from "clsx"
import { HandCoins, Wallet } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import type { CommissionSummaryRowDto, ExpenseDto, SalespersonDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, ListToolbar } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatDate, formatMoney, todayIST } from "@/lib/format"
import { ExpenseDetail } from "../finance/ExpensesList"
import { AccountSelect } from "../payments/shared"
import { useCommissionDetail, useCommissionPayouts, useCommissionSummary, useRecordPayout } from "./api"

type Period = { from: string; to: string }

const owedLabel = (owed: string) => (Number(owed) < 0 ? `${formatMoney(-Number(owed))} paid ahead` : formatMoney(owed))

function PayoutModal({
  people,
  initial,
  onClose,
}: {
  people: { salesperson: SalespersonDto; owed: string }[]
  initial: string | null
  onClose: () => void
}) {
  const record = useRecordPayout()
  const owedFor = (id: string) => people.find((p) => p.salesperson.id === id)?.owed ?? "0"
  const suggested = (id: string) => (Number(owedFor(id)) > 0 ? owedFor(id) : "")
  const [salespersonId, setSalespersonId] = useState(initial ?? "")
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState(initial ? suggested(initial) : "")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await record.mutateAsync({
        salespersonId,
        accountId,
        amount: amount.trim(),
        businessDate,
        reference: reference || null,
        notes: notes || null,
      })
      toast.success("Payout recorded")
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Record commission payout"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={record.isPending} disabled={!salespersonId || !accountId || !amount.trim()}>
            Record payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <Field
          label="Paid to"
          htmlFor="po-person"
          required
          hint={salespersonId ? `Owed now: ${owedLabel(owedFor(salespersonId))}` : undefined}
        >
          <Select
            id="po-person"
            value={salespersonId}
            onChange={(e) => {
              setSalespersonId(e.target.value)
              setAmount(suggested(e.target.value))
            }}
          >
            <option value="">Choose salesperson</option>
            {people.map(({ salesperson: p }) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.staffCode})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" htmlFor="po-amount" required>
            <Input id="po-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="po-date" required>
            <Input id="po-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Paid from" htmlFor="po-account" required hint="Shows in this account's movements and that day's cash count.">
          <AccountSelect id="po-account" value={accountId} onChange={setAccountId} />
        </Field>
        <Field label="Reference" htmlFor="po-ref" hint="e.g. October commission">
          <Input id="po-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="po-notes">
          <Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

const cell = "px-3 py-2 text-sm"
const head = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"

function DetailModal({ id, period, onPay, onClose }: { id: string; period: Period; onPay: () => void; onClose: () => void }) {
  const { data } = useCommissionDetail(id, period)
  const [openPayout, setOpenPayout] = useState<string | null>(null)
  if (!data) return null
  const t = data.totals
  return (
    <Modal
      title={`${data.salesperson.name} (${data.salesperson.staffCode})`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <Button icon={<HandCoins size={15} />} onClick={onPay}>
          Record payout
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted">
          {formatDate(data.from)} – {formatDate(data.to)} · rate now {data.salesperson.commissionRate}% · owed now{" "}
          <span className="font-semibold text-text">{owedLabel(t.owed)}</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            ["Gross profit", formatMoney(t.grossProfit)],
            ["Earned", formatMoney(t.earned)],
            ["Taken back", formatMoney(t.returned)],
            ["Paid", formatMoney(t.paid)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border px-3 py-2">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-semibold tabular">{value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead className="bg-surface-2">
              <tr>
                <th className={`${head} text-left`}>Date</th>
                <th className={`${head} text-left`}>Sale</th>
                <th className={`${head} text-right`}>Value excl. GST</th>
                <th className={`${head} text-right`}>Gross profit</th>
                <th className={`${head} text-right`}>Rate</th>
                <th className={`${head} text-right`}>Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${cell} text-center text-faint`}>
                    No sales or returns in this period
                  </td>
                </tr>
              )}
              {data.entries.map((e) => (
                <tr key={`${e.order.id}-${e.salesReturn?.id ?? "sale"}`}>
                  <td className={`${cell} whitespace-nowrap`}>{formatDate(e.date)}</td>
                  <td className={cell}>
                    <Link href={`/sales/${e.order.id}`} className="font-mono text-xs text-primary hover:underline">
                      {e.order.code}
                    </Link>
                    {e.salesReturn && (
                      <span className="ml-2">
                        <Badge tone="yellow">Return {e.salesReturn.code}</Badge>
                      </span>
                    )}
                    {e.costMissingUnits > 0 && (
                      <span className="ml-2" title="These units have no recorded cost, so they earn no commission">
                        <Badge tone="red">
                          {e.costMissingUnits} unit{e.costMissingUnits === 1 ? "" : "s"} without cost
                        </Badge>
                      </span>
                    )}
                  </td>
                  <td className={`${cell} text-right tabular`}>{formatMoney(e.value)}</td>
                  <td className={`${cell} text-right tabular`}>{formatMoney(e.profit)}</td>
                  <td className={`${cell} text-right tabular`}>{e.rate}%</td>
                  <td className={`${cell} text-right tabular font-medium`}>{formatMoney(e.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.payouts.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Payouts in this period</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.payouts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpenPayout(p.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left hover:bg-surface-2"
                  >
                    <span>
                      <span className="font-mono text-xs">{p.code}</span> · {formatDate(p.businessDate)} · {p.account.name}
                      {p.reversalOf && <span className="text-faint"> · voids {p.reversalOf.code}</span>}
                      {p.reversedBy && <span className="text-faint"> · voided</span>}
                    </span>
                    <span className="tabular font-medium">{formatMoney(p.reversalOf ? -Number(p.amount) : p.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {openPayout && <ExpenseDetail id={openPayout} onClose={() => setOpenPayout(null)} />}
    </Modal>
  )
}

type View = "summary" | "toPay" | "payouts"

const VIEWS: { key: View; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "toPay", label: "To pay" },
  { key: "payouts", label: "Payouts" },
]

/** Everyone owed commission right now (all time), most owed first, each with a one-click payout. */
function ToPay({ rows, loading, onPay }: { rows: CommissionSummaryRowDto[]; loading: boolean; onPay: (id: string) => void }) {
  const owing = rows.filter((r) => Number(r.owed) > 0).sort((a, b) => Number(b.owed) - Number(a.owed))
  const total = owing.reduce((s, r) => s + Number(r.owed), 0)
  const columns: ColumnDef<CommissionSummaryRowDto>[] = [
    {
      id: "name",
      header: "Salesperson",
      cell: ({ row }) => (
        <span>
          <span className="font-medium">{row.original.salesperson.name}</span>{" "}
          <span className="font-mono text-xs text-muted">{row.original.salesperson.staffCode}</span>
        </span>
      ),
    },
    { id: "login", header: "CRM login", cell: ({ row }) => row.original.salesperson.user?.name ?? <span className="text-faint">—</span> },
    {
      id: "owed",
      header: "To pay",
      meta: { align: "right", cellClassName: "font-semibold tabular" },
      cell: ({ row }) => formatMoney(row.original.owed),
    },
    {
      id: "pay",
      meta: { align: "right" },
      cell: ({ row }) => (
        <Button size="sm" icon={<HandCoins size={14} />} onClick={() => onPay(row.original.salesperson.id)}>
          Pay
        </Button>
      ),
    },
  ]
  return (
    <Card>
      <p className="text-sm text-muted mb-3">
        Total to pay <span className="font-semibold text-text tabular">{formatMoney(total)}</span> to {owing.length}{" "}
        {owing.length === 1 ? "person" : "people"}. This is everything earned and not yet paid, all time.
      </p>
      <DataTable
        columns={columns}
        data={loading ? undefined : owing}
        total={owing.length}
        page={1}
        limit={100}
        loading={loading}
        onPageChange={() => {}}
        getRowId={(r) => r.salesperson.id}
        emptyTitle="Nothing to pay"
        emptyHint="Everyone has been paid all the commission they've earned."
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {r.salesperson.name} <span className="font-mono text-xs text-muted">{r.salesperson.staffCode}</span>
              </p>
              <p className="text-sm font-semibold tabular">{formatMoney(r.owed)}</p>
            </div>
            <Button size="sm" onClick={() => onPay(r.salesperson.id)}>
              Pay
            </Button>
          </div>
        )}
      />
    </Card>
  )
}

/** Every payout dated in the period, voids included. */
function Payouts({ period, dates }: { period: Period; dates: React.ReactNode }) {
  const { data, isLoading } = useCommissionPayouts(period)
  const [openId, setOpenId] = useState<string | null>(null)
  const signed = (p: ExpenseDto) => (p.reversalOf ? -Number(p.amount) : Number(p.amount))
  const columns: ColumnDef<ExpenseDto>[] = [
    { id: "date", header: "Date", meta: { cellClassName: "whitespace-nowrap" }, cell: ({ row }) => formatDate(row.original.businessDate) },
    { id: "code", header: "Payout", meta: { cellClassName: "font-mono text-xs" }, cell: ({ row }) => row.original.code },
    {
      id: "to",
      header: "Paid to",
      cell: ({ row }) =>
        row.original.salesperson ? (
          <span>
            {row.original.salesperson.name} <span className="font-mono text-xs text-muted">{row.original.salesperson.staffCode}</span>
          </span>
        ) : null,
    },
    { id: "account", header: "Paid from", cell: ({ row }) => row.original.account.name },
    {
      id: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <span>
          {row.original.reference ?? ""}
          {row.original.reversalOf && <span className="text-faint"> · voids {row.original.reversalOf.code}</span>}
          {row.original.reversedBy && (
            <span className="ml-2">
              <Badge tone="gray">Voided</Badge>
            </span>
          )}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right", cellClassName: "tabular font-medium" },
      cell: ({ row }) => formatMoney(signed(row.original)),
    },
  ]
  const total = (data ?? []).reduce((s, p) => s + signed(p), 0)
  return (
    <Card>
      <ListToolbar>{dates}</ListToolbar>
      <p className="text-sm text-muted mb-3">
        Paid out in these dates <span className="font-semibold text-text tabular">{formatMoney(total)}</span>, after voids.
      </p>
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={1000}
        loading={isLoading}
        onPageChange={() => {}}
        onRowClick={(p) => setOpenId(p.id)}
        getRowId={(p) => p.id}
        emptyTitle="No payouts in these dates"
        mobileCard={(p) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {p.salesperson ? `${p.salesperson.name} (${p.salesperson.staffCode})` : p.code}
              </p>
              <p className="text-xs text-muted">
                {formatDate(p.businessDate)} · {p.account.name}
                {p.reversedBy && " · voided"}
              </p>
            </div>
            <p className="text-sm font-semibold tabular">{formatMoney(signed(p))}</p>
          </div>
        )}
      />
      {openId && <ExpenseDetail id={openId} onClose={() => setOpenId(null)} />}
    </Card>
  )
}

export default function CommissionPage() {
  const [period, setPeriod] = useState<Period>(() => ({ from: `${todayIST().slice(0, 7)}-01`, to: todayIST() }))
  const { data, isLoading } = useCommissionSummary(period)
  const [openId, setOpenId] = useState<string | null>(null)
  const [paying, setPaying] = useState<{ initial: string | null } | null>(null)
  const [view, setView] = useState<View>("summary")
  const rows = data?.rows ?? []
  const owingCount = rows.filter((r) => Number(r.owed) > 0).length
  const dates = (
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
  )

  const columns: ColumnDef<CommissionSummaryRowDto>[] = [
    {
      id: "name",
      header: "Salesperson",
      cell: ({ row }) => (
        <span>
          <span className="font-medium">{row.original.salesperson.name}</span>{" "}
          <span className="font-mono text-xs text-muted">{row.original.salesperson.staffCode}</span>
          {!row.original.salesperson.isActive && (
            <span className="ml-2">
              <Badge tone="gray">Inactive</Badge>
            </span>
          )}
        </span>
      ),
    },
    { id: "rate", header: "Rate now", meta: { align: "right" }, cell: ({ row }) => `${row.original.salesperson.commissionRate}%` },
    { id: "sales", header: "Sales", meta: { align: "right" }, cell: ({ row }) => row.original.sales },
    { id: "value", header: "Net sales excl. GST", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.salesValue) },
    {
      id: "profit",
      header: "Gross profit",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span title={row.original.costMissingUnits > 0 ? `${row.original.costMissingUnits} units without cost earned nothing` : undefined}>
          {formatMoney(row.original.grossProfit)}
          {row.original.costMissingUnits > 0 && <span className="text-red-500"> *</span>}
        </span>
      ),
    },
    { id: "earned", header: "Earned", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.earned) },
    { id: "returned", header: "Taken back", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.returned) },
    {
      id: "net",
      header: "Net",
      meta: { align: "right", cellClassName: "font-semibold" },
      cell: ({ row }) => formatMoney(row.original.net),
    },
    { id: "paid", header: "Paid", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.paid) },
    {
      id: "owed",
      header: "Owed now",
      meta: { align: "right", cellClassName: "font-semibold" },
      cell: ({ row }) => owedLabel(row.original.owed),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Commission"
        subtitle="Commission is a % of gross profit (sale value excluding GST minus cost), counted when a sale is handed over or dispatched; returns take it back, and items without a recorded cost or sold at a loss earn nothing. Owed is all time."
        action={
          <Button icon={<HandCoins size={16} />} onClick={() => setPaying({ initial: null })} disabled={rows.length === 0}>
            Record payout
          </Button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Net commission" value={formatMoney(data?.totals.net ?? 0)} hint="In the period" icon={<HandCoins size={18} />} />
        <StatCard title="Paid out" value={formatMoney(data?.totals.paid ?? 0)} hint="In the period" icon={<Wallet size={18} />} />
        <StatCard title="Owed now" value={formatMoney(data?.totals.owed ?? 0)} hint="All salespeople, all time" />
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto scrollbar-none border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={clsx(
              "px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              view === v.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text",
            )}
          >
            {v.label}
            {v.key === "toPay" && owingCount > 0 && <span className="ml-1.5 text-xs text-muted">({owingCount})</span>}
          </button>
        ))}
      </div>
      {view === "toPay" && <ToPay rows={rows} loading={isLoading} onPay={(id) => setPaying({ initial: id })} />}
      {view === "payouts" && <Payouts period={period} dates={dates} />}
      <Card className={view === "summary" ? undefined : "hidden"}>
        <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/reports/salesperson-commission", period, format)} />}>
          {dates}
        </ListToolbar>
        <DataTable
          columns={columns}
          data={data?.rows}
          total={rows.length}
          page={1}
          limit={100}
          loading={isLoading}
          onPageChange={() => {}}
          onRowClick={(r) => setOpenId(r.salesperson.id)}
          getRowId={(r) => r.salesperson.id}
          emptyTitle="No salespeople yet"
          emptyHint="Add salespeople and their commission % in Settings → Salespeople."
          mobileCard={(r) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {r.salesperson.name} <span className="font-mono text-xs text-muted">{r.salesperson.staffCode}</span>
                </p>
                <p className="text-xs text-muted">
                  {r.sales} sales · net {formatMoney(r.net)} · paid {formatMoney(r.paid)}
                </p>
              </div>
              <p className="text-sm font-semibold tabular">{owedLabel(r.owed)}</p>
            </div>
          )}
        />
      </Card>
      {openId && (
        <DetailModal
          id={openId}
          period={period}
          onClose={() => setOpenId(null)}
          onPay={() => {
            setPaying({ initial: openId })
            setOpenId(null)
          }}
        />
      )}
      {paying && <PayoutModal people={rows} initial={paying.initial} onClose={() => setPaying(null)} />}
    </div>
  )
}
