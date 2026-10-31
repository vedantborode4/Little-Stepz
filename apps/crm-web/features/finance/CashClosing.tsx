"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Lock, LockOpen } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { CashDayDto, CashSessionDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, Input, Select, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatDateTime, formatMoney, todayIST } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useReceivingAccounts } from "../settings/api"
import { useCashDay, useCashSessions, useCloseCashDay, useOpenCashDay, useReopenCashDay } from "./api"

const paise = (v: string | number) => Math.round(Number(v || 0) * 100)

export function DiscrepancyBadge({ value }: { value: string | null }) {
  if (value === null) return null
  const p = paise(value)
  if (p === 0) return <Badge tone="green">Exact</Badge>
  return <Badge tone={p < 0 ? "red" : "yellow"}>{p < 0 ? `Short ${formatMoney(-p / 100)}` : `Over ${formatMoney(p / 100)}`}</Badge>
}

function Breakdown({ day }: { day: CashDayDto }) {
  const b = day.breakdown
  const row = (label: string, value: string, sign: "" | "+" | "−" = "", strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t border-border mt-1 pt-2.5 text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className="tabular">
        {sign && Number(value) !== 0 ? `${sign} ` : ""}
        {formatMoney(value)}
      </span>
    </div>
  )
  return (
    <div>
      {row("Opening cash", b.opening)}
      {row("Cash received", b.received, "+")}
      {row("Refunds paid in cash", b.refunded, "−")}
      {row("Expenses paid in cash", b.expenses, "−")}
      {row("Moved in from other accounts", b.transfersIn, "+")}
      {row("Deposited / moved out", b.transfersOut, "−")}
      {row("Expected in the drawer", b.expected, "", true)}
    </div>
  )
}

function DayActions({ day, accountName }: { day: CashDayDto; accountName: string }) {
  const can = useCan()
  const open = useOpenCashDay()
  const session = day.session
  const closeDay = useCloseCashDay(session?.id ?? "")
  const reopen = useReopenCashDay(session?.id ?? "")
  const [opening, setOpening] = useState(day.previousClose?.counted ?? "0")
  const [counted, setCounted] = useState("")
  const [notes, setNotes] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reason, setReason] = useState("")
  const difference = counted.trim() ? (paise(counted) - paise(day.breakdown.expected)) / 100 : null

  if (!session) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Start the day with the cash in the drawer.
          {day.previousClose && ` Last count (${formatDate(day.previousClose.date)}) was ${formatMoney(day.previousClose.counted)}.`}
        </p>
        <Field label="Opening cash (₹)" htmlFor="cash-opening">
          <Input id="cash-opening" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </Field>
        <Button
          loading={open.isPending}
          onClick={async () => {
            try {
              await open.mutateAsync({ accountId: day.accountId, businessDate: day.date, openingAmount: opening.trim() || null })
              toast.success("Day opened")
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        >
          Open the day
        </Button>
      </div>
    )
  }

  if (session.status === "CLOSED") {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Lock size={15} className="text-faint" />
          <span>
            Closed {formatDateTime(session.closedAt)} by {session.closedByName ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Counted</span>
          <span className="tabular font-semibold">{formatMoney(session.countedAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Difference</span>
          <DiscrepancyBadge value={session.discrepancy} />
        </div>
        {session.notes && <p className="text-muted">{session.notes}</p>}
        <p className="text-xs text-faint">Nothing can be posted to {accountName} on this date while it&apos;s closed.</p>
        {can("cash.reopen") && (
          <Button variant="ghost" size="sm" icon={<LockOpen size={14} />} onClick={() => setReopening(true)}>
            Reopen day
          </Button>
        )}
        {reopening && (
          <ConfirmDialog
            title="Reopen this day?"
            message={
              <div className="space-y-3">
                <p>
                  Postings to this drawer on {formatDate(day.date)} are allowed again until it&apos;s closed and counted again. The old
                  count stays in the audit log.
                </p>
                <Field label="Reason" htmlFor="reopen-reason" required>
                  <Textarea id="reopen-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              </div>
            }
            confirmLabel="Reopen"
            confirmDisabled={!reason.trim()}
            loading={reopen.isPending}
            onCancel={() => setReopening(false)}
            onConfirm={async () => {
              try {
                await reopen.mutateAsync(reason.trim())
                setReopening(false)
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Count the drawer and enter what&apos;s there. The difference is recorded; sales and payments don&apos;t change.
      </p>
      <Field label="Counted cash (₹)" htmlFor="cash-counted">
        <Input id="cash-counted" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />
      </Field>
      {difference !== null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Difference</span>
          <DiscrepancyBadge value={difference.toFixed(2)} />
        </div>
      )}
      <Field label="Notes" htmlFor="cash-notes" hint="e.g. why it's short or over">
        <Textarea id="cash-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button icon={<Lock size={15} />} disabled={!counted.trim()} onClick={() => setConfirming(true)}>
        Close the day
      </Button>
      {confirming && (
        <ConfirmDialog
          title={`Close ${accountName} for ${formatDate(day.date)}?`}
          message={`Counted ${formatMoney(counted)} against ${formatMoney(day.breakdown.expected)} expected. The day is then locked.`}
          confirmLabel="Close day"
          tone="primary"
          loading={closeDay.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              await closeDay.mutateAsync({ countedAmount: counted.trim(), notes: notes.trim() || null })
              setConfirming(false)
              toast.success("Day closed")
            } catch (err) {
              toast.error(errorMessage(err))
              setConfirming(false)
            }
          }}
        />
      )}
    </div>
  )
}

function History({ accountId }: { accountId: string }) {
  const { state, update, params } = useListState()
  const { data, isLoading } = useCashSessions({ ...params, accountId })
  const columns: ColumnDef<CashSessionDto>[] = [
    { id: "date", header: "Day", cell: ({ row }) => formatDate(row.original.businessDate) },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.status === "CLOSED" ? "gray" : "blue"}>{row.original.status === "CLOSED" ? "Closed" : "Open"}</Badge>
      ),
    },
    {
      id: "opening",
      header: "Opening",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => formatMoney(row.original.openingAmount),
    },
    {
      id: "expected",
      header: "Expected",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => formatMoney(row.original.expectedAmount),
    },
    {
      id: "counted",
      header: "Counted",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => formatMoney(row.original.countedAmount),
    },
    { id: "diff", header: "Difference", cell: ({ row }) => <DiscrepancyBadge value={row.original.discrepancy} /> },
    { id: "by", header: "Closed by", cell: ({ row }) => row.original.closedByName ?? "—" },
  ]
  return (
    <DataTable
      columns={columns}
      data={data?.items}
      total={data?.total ?? 0}
      page={state.page}
      limit={state.limit}
      loading={isLoading}
      onPageChange={(page) => update({ page })}
      getRowId={(s) => s.id}
      emptyTitle="No days counted yet"
      mobileCard={(s) => (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{formatDate(s.businessDate)}</p>
            <p className="text-xs text-muted">
              Expected {formatMoney(s.expectedAmount)} · counted {formatMoney(s.countedAmount)}
            </p>
          </div>
          <DiscrepancyBadge value={s.discrepancy} />
        </div>
      )}
    />
  )
}

export default function CashClosing() {
  const accounts = useReceivingAccounts()
  const drawers = (accounts.data ?? []).filter((a) => a.method === "CASH" && a.isActive)
  const [chosen, setChosen] = useState("")
  const [date, setDate] = useState(todayIST())
  const accountId = chosen || drawers[0]?.id || ""
  const day = useCashDay(accountId, date)
  const accountName = drawers.find((a) => a.id === accountId)?.name ?? "the drawer"

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Cash Closing" subtitle="Count the drawer at the end of the day against what the books say should be there." />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Select aria-label="Cash drawer" value={accountId} onChange={(e) => setChosen(e.target.value)}>
            {drawers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Input type="date" aria-label="Day" max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {day.data?.session && (
          <Badge tone={day.data.session.status === "CLOSED" ? "gray" : "blue"}>
            {day.data.session.status === "CLOSED" ? "Closed" : "Open"}
          </Badge>
        )}
      </div>
      {accounts.isLoading || (accountId && day.isLoading) ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !accountId ? (
        <p className="text-sm text-muted">Add a cash account in Settings → Receiving accounts first.</p>
      ) : (
        day.data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
            <Card title={`${accountName} · ${formatDate(date)}`}>
              <Breakdown day={day.data} />
            </Card>
            <Card title={!day.data.session ? "Open" : day.data.session.status === "CLOSED" ? "Counted" : "Count & close"}>
              <DayActions key={`${accountId}-${date}-${day.data.session?.status ?? "none"}`} day={day.data} accountName={accountName} />
            </Card>
          </div>
        )
      )}
      {accountId && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Earlier days</h2>
          <History accountId={accountId} />
        </section>
      )}
    </div>
  )
}
