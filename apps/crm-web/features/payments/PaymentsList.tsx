"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentDirection,
  type PaymentListItemDto,
  type PaymentMethod,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, DetailRow, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatDate, formatDateTime, formatMoney, todayIST } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import CustomerSelect, { type ChosenCustomer } from "../sales/CustomerSelect"
import { useOutstanding, usePayment, useReceivePayment, useVoidPayment, usePayments } from "./api"
import { AccountSelect, PaymentTabs } from "./shared"

type Filters = { direction?: PaymentDirection; method?: PaymentMethod; accountKind?: "business" | "personal"; from?: string; to?: string }

const paise = (v: string | number) => Math.round(Number(v || 0) * 100)

/** Receive money from a customer and spread it over their unpaid orders, oldest first. */
function ReceivePaymentModal({ onClose }: { onClose: () => void }) {
  const receive = useReceivePayment()
  const [customer, setCustomer] = useState<ChosenCustomer | null>(null)
  const outstanding = useOutstanding({ customerId: customer?.id, limit: 50 }, Boolean(customer))
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [keepExcess, setKeepExcess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orders = [...(outstanding.data?.items ?? [])].sort((a, b) => a.orderDate.localeCompare(b.orderDate))
  const allocated = Object.values(allocations).reduce((s, v) => s + paise(v), 0)
  const excess = paise(amount) - allocated

  const autoAllocate = () => {
    let left = paise(amount)
    const next: Record<string, string> = {}
    for (const o of orders) {
      const take = Math.min(left, paise(o.due))
      if (take > 0) next[o.orderId] = (take / 100).toFixed(2)
      left -= take
    }
    setAllocations(next)
  }

  const submit = async () => {
    setError(null)
    try {
      await receive.mutateAsync({
        customerId: customer!.id,
        accountId,
        amount,
        reference: reference || null,
        businessDate,
        allocations: Object.entries(allocations)
          .filter(([, v]) => paise(v) > 0)
          .map(([orderId, v]) => ({ orderId, amount: v })),
        excessToCredit: keepExcess,
      })
      toast.success("Payment recorded")
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Record a payment"
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={receive.isPending}
            disabled={!customer || !accountId || paise(amount) <= 0 || excess < 0 || (excess > 0 && !keepExcess)}
            onClick={submit}
          >
            Record {formatMoney(amount || 0)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <CustomerSelect
          value={customer}
          onChange={(c) => {
            setCustomer(c)
            setAllocations({})
          }}
          placeholder="Search customer by mobile or name"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Received into" htmlFor="rp-account" required>
            <AccountSelect id="rp-account" value={accountId} onChange={setAccountId} />
          </Field>
          <Field label="Amount (₹)" htmlFor="rp-amount" required>
            <Input id="rp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="rp-date">
            <Input id="rp-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
          <Field label="Reference" htmlFor="rp-ref" hint="UPI ref, UTR or cheque no.">
            <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>

        {customer && (
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">Apply to unpaid orders</p>
              <Button size="sm" variant="ghost" disabled={paise(amount) <= 0 || orders.length === 0} onClick={autoAllocate}>
                Oldest first
              </Button>
            </div>
            {outstanding.isLoading ? (
              <Skeleton className="h-16 m-3" />
            ) : orders.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted">Nothing is due. The whole payment can be kept as credit.</p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.orderId} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{o.code}</span>
                    <span className="text-muted">{formatDate(o.orderDate)}</span>
                    <span className="flex-1 text-right text-muted tabular">{formatMoney(o.due)} due</span>
                    <div className="w-28">
                      <Input
                        aria-label={`Apply to ${o.code}`}
                        inputMode="decimal"
                        placeholder="0"
                        value={allocations[o.orderId] ?? ""}
                        onChange={(e) => setAllocations((a) => ({ ...a, [o.orderId]: e.target.value }))}
                        className="py-1.5 text-right tabular"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {excess < 0 && <p className="text-xs text-red-500">More is applied to orders than was received.</p>}
        {excess > 0 && customer && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepExcess} onChange={(e) => setKeepExcess(e.target.checked)} />
            Keep {formatMoney(excess / 100)} not applied to orders as {customer.name}&apos;s credit
          </label>
        )}
      </div>
    </Modal>
  )
}

function PaymentModal({ id, onClose }: { id: string; onClose: () => void }) {
  const can = useCan()
  const { data } = usePayment(id)
  const voidPayment = useVoidPayment(id)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState("")
  if (!data) return null
  const canVoid = can("payments.refund") && !data.reversalOf && !data.reversedBy

  return (
    <Modal
      title={`${data.code} · ${PAYMENT_DIRECTION_LABELS[data.direction]}`}
      onClose={onClose}
      footer={
        canVoid &&
        (voiding ? (
          <>
            <Button variant="secondary" onClick={() => setVoiding(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={voidPayment.isPending}
              onClick={async () => {
                try {
                  await voidPayment.mutateAsync(reason.trim())
                  toast.success("Payment voided")
                  onClose()
                } catch (err) {
                  toast.error(errorMessage(err))
                }
              }}
            >
              Void payment
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setVoiding(true)}>
            Void…
          </Button>
        ))
      }
    >
      {voiding ? (
        <div className="space-y-3 text-sm">
          <p>A reversing entry is recorded and any order balance or credit from this payment is undone. Use it for mistakes only.</p>
          <Field label="Reason" htmlFor="void-reason" required>
            <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      ) : (
        <dl>
          <DetailRow label="Amount">{formatMoney(data.amount)}</DetailRow>
          {Number(data.fee) > 0 && <DetailRow label="Provider fee">{formatMoney(data.fee)}</DetailRow>}
          <DetailRow label="Account">
            {data.account.name} · {PAYMENT_METHOD_LABELS[data.method]}
          </DetailRow>
          <DetailRow label="Date">{formatDate(data.businessDate)}</DetailRow>
          <DetailRow label="Reference">{data.reference ?? "—"}</DetailRow>
          <DetailRow label="Customer">{data.customer ? `${data.customer.name} (${data.customer.code})` : "Walk-in"}</DetailRow>
          {data.allocations.map((a) => (
            <DetailRow key={a.orderId} label={`Order ${a.orderCode}`}>
              <Link href={`/sales/${a.orderId}`} className="text-primary hover:underline">
                {formatMoney(a.amount)}
              </Link>
            </DetailRow>
          ))}
          {Number(data.creditAmount) !== 0 && <DetailRow label="Customer credit">{formatMoney(data.creditAmount)}</DetailRow>}
          {data.reversalOf && <DetailRow label="Voids">{data.reversalOf.code}</DetailRow>}
          {data.reversedBy && <DetailRow label="Voided by">{data.reversedBy.code}</DetailRow>}
          <DetailRow label="Recorded">
            {formatDateTime(data.createdAt)} by {data.createdByName ?? "—"}
          </DetailRow>
          {data.notes && <DetailRow label="Notes">{data.notes}</DetailRow>}
        </dl>
      )}
    </Modal>
  )
}

export default function PaymentsList() {
  const can = useCan()
  const { state, update, params } = useListState<Filters>({ sort: "createdAt:desc" })
  const { data, isLoading } = usePayments(params)
  const [receiving, setReceiving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const f = state.filters

  const columns: ColumnDef<PaymentListItemDto>[] = [
    {
      id: "code",
      header: "Payment",
      meta: { sortKey: "code" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">{row.original.code}</span>
          {row.original.reversalOf && <Badge tone="gray">Void of {row.original.reversalOf.code}</Badge>}
          {row.original.reversedBy && <Badge tone="gray">Voided</Badge>}
        </div>
      ),
    },
    {
      id: "businessDate",
      header: "Date",
      meta: { sortKey: "businessDate", cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.businessDate),
    },
    {
      id: "account",
      header: "Account",
      cell: ({ row }) => (
        <span>
          {row.original.account.name}
          {row.original.account.isPersonal && <span className="ml-1 text-xs text-yellow-700 dark:text-yellow-400">personal</span>}
        </span>
      ),
    },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? <span className="text-faint">Walk-in</span> },
    { id: "orders", header: "Orders", cell: ({ row }) => row.original.orderCodes.join(", ") || <span className="text-faint">—</span> },
    { id: "reference", header: "Reference", meta: { defaultHidden: true }, cell: ({ row }) => row.original.reference ?? "—" },
    {
      id: "amount",
      header: "Amount",
      meta: { sortKey: "amount", align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => (
        <span className={row.original.direction === "OUT" ? "text-red-500" : ""}>
          {row.original.direction === "OUT" ? "−" : ""}
          {formatMoney(row.original.amount)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every rupee in and out, with the account it went to. Corrections are voids, never edits."
        action={
          can("payments.record") && (
            <Button icon={<Plus size={16} />} onClick={() => setReceiving(true)}>
              Record payment
            </Button>
          )
        }
      />
      <PaymentTabs />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/payments", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Payment, reference, order or customer" />
        <FilterSelect
          label="Method"
          value={f.method}
          onChange={(method) => update({ filters: { method: method as PaymentMethod | undefined } })}
        >
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Accounts"
          value={f.accountKind}
          onChange={(accountKind) => update({ filters: { accountKind: accountKind as Filters["accountKind"] } })}
        >
          <option value="">Business & personal</option>
          <option value="business">Business accounts</option>
          <option value="personal">Personal accounts</option>
        </FilterSelect>
        <FilterSelect
          label="Direction"
          value={f.direction}
          onChange={(direction) => update({ filters: { direction: direction as PaymentDirection | undefined } })}
        >
          <option value="">In & out</option>
          <option value="IN">Received</option>
          <option value="OUT">Paid out</option>
        </FilterSelect>
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label="From date"
            value={f.from ?? ""}
            onChange={(e) => update({ filters: { from: e.target.value || undefined } })}
            className="py-2 sm:w-40"
          />
          <Input
            type="date"
            aria-label="To date"
            value={f.to ?? ""}
            onChange={(e) => update({ filters: { to: e.target.value || undefined } })}
            className="py-2 sm:w-40"
          />
        </div>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        onRowClick={(p) => setOpenId(p.id)}
        getRowId={(p) => p.id}
        emptyTitle="No payments yet"
        mobileCard={(p) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{p.customer?.name ?? "Walk-in"}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{p.code}</span> · {formatDate(p.businessDate)} · {p.account.name}
              </p>
            </div>
            <p className={`text-sm font-semibold tabular ${p.direction === "OUT" ? "text-red-500" : ""}`}>
              {p.direction === "OUT" ? "−" : ""}
              {formatMoney(p.amount)}
            </p>
          </div>
        )}
      />
      {receiving && <ReceivePaymentModal onClose={() => setReceiving(false)} />}
      {openId && <PaymentModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
