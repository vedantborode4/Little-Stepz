"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { EXPENSE_KIND_LABELS, EXPENSE_KINDS, type ExpenseDto, type ExpenseKind, type SalesOrderListItemDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, DetailRow, PageHeader } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import LinkTabs from "@/components/ui/Tabs"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatDate, formatDateTime, formatMoney, todayIST } from "@/lib/format"
import { useDebounced } from "@/lib/use-debounced"
import { useListState } from "@/lib/use-list-state"
import { AccountSelect } from "../payments/shared"
import { useOrders } from "../sales/api"
import { useCreateExpense, useExpense, useExpenseCategories, useExpenses, useVoidExpense } from "./api"

type Filters = { categoryId?: string; kind?: ExpenseKind; from?: string; to?: string }

export function ExpenseTabs() {
  return (
    <LinkTabs
      tabs={[
        { label: "Expenses", href: "/expenses", exact: true },
        { label: "Categories", href: "/expenses/categories" },
      ]}
    />
  )
}

function OrderPicker({ value, onChange }: { value: SalesOrderListItemDto | null; onChange: (o: SalesOrderListItemDto | null) => void }) {
  const [q, setQ] = useState("")
  const term = useDebounced(q.trim(), 250)
  const { data } = useOrders({ q: term, limit: 6 }, term.length > 1)
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
        <span className="font-mono">{value.code}</span>
        <span className="text-muted flex-1 truncate">{value.customer?.name ?? "Walk-in"}</span>
        <button type="button" className="text-xs text-primary" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <Input aria-label="Find order" placeholder="Order no. or customer" value={q} onChange={(e) => setQ(e.target.value)} />
      {term.length > 1 && (
        <ul className="rounded-xl border border-border divide-y divide-border">
          {(data?.items ?? [])
            .filter((o) => o.status !== "DRAFT")
            .map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full flex gap-2 px-3 py-2 text-sm text-left font-normal hover:bg-surface-2"
                  onClick={() => onChange(o)}
                >
                  <span className="font-mono">{o.code}</span>
                  <span className="text-muted truncate">{o.customer?.name ?? "Walk-in"}</span>
                </button>
              </li>
            ))}
          {data?.items.length === 0 && <li className="px-3 py-2 text-sm text-muted">No order matches.</li>}
        </ul>
      )}
    </div>
  )
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const create = useCreateExpense()
  const categories = useExpenseCategories()
  const [categoryId, setCategoryId] = useState("")
  const [kind, setKind] = useState<ExpenseKind>("OPERATING")
  const [order, setOrder] = useState<SalesOrderListItemDto | null>(null)
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [vendor, setVendor] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal
      title="Record an expense"
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!categoryId || !accountId || !amount || (kind === "ORDER" && !order)}
            onClick={async () => {
              setError(null)
              try {
                await create.mutateAsync({
                  categoryId,
                  kind,
                  orderId: order?.id ?? null,
                  accountId,
                  amount,
                  businessDate,
                  vendor: vendor || null,
                  reference: reference || null,
                  notes: notes || null,
                })
                toast.success("Expense recorded")
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Save {amount ? formatMoney(amount) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" htmlFor="ex-cat" required>
            <Select id="ex-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="ex-kind">
            <Select id="ex-kind" value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind)}>
              {EXPENSE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EXPENSE_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "ORDER" && (
            <Field label="Order" className="sm:col-span-2" required>
              <OrderPicker value={order} onChange={setOrder} />
            </Field>
          )}
          <Field label="Paid from" htmlFor="ex-account" required>
            <AccountSelect id="ex-account" value={accountId} onChange={setAccountId} />
          </Field>
          <Field label="Amount (₹)" htmlFor="ex-amount" required>
            <Input id="ex-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="ex-date">
            <Input id="ex-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
          <Field label="Paid to" htmlFor="ex-vendor">
            <Input id="ex-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Bill / reference" htmlFor="ex-ref">
            <Input id="ex-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="ex-notes" className="sm:col-span-2">
            <Textarea id="ex-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function ExpenseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useExpense(id)
  const voidIt = useVoidExpense(id)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState("")
  if (!data) return null
  const canVoid = !data.reversalOf && !data.reversedBy
  return (
    <Modal
      title={`${data.code} · ${data.category.name}`}
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
              loading={voidIt.isPending}
              onClick={async () => {
                try {
                  await voidIt.mutateAsync(reason.trim())
                  toast.success("Expense voided")
                  onClose()
                } catch (err) {
                  toast.error(errorMessage(err))
                }
              }}
            >
              Void expense
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
        <Field label="Why is this being voided?" htmlFor="void-reason" required>
          <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      ) : (
        <dl>
          <DetailRow label="Amount">{formatMoney(data.amount)}</DetailRow>
          <DetailRow label="Type">{EXPENSE_KIND_LABELS[data.kind]}</DetailRow>
          {data.order && (
            <DetailRow label="Order">
              <Link href={`/sales/${data.order.id}`} className="text-primary hover:underline">
                {data.order.code}
              </Link>
            </DetailRow>
          )}
          <DetailRow label="Paid from">{data.account.name}</DetailRow>
          <DetailRow label="Date">{formatDate(data.businessDate)}</DetailRow>
          <DetailRow label="Paid to">{data.vendor ?? "—"}</DetailRow>
          <DetailRow label="Reference">{data.reference ?? "—"}</DetailRow>
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

export default function ExpensesList() {
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = useExpenses(params)
  const categories = useExpenseCategories(true)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const f = state.filters

  const signed = (e: ExpenseDto) => (e.reversalOf ? `−${formatMoney(e.amount)}` : formatMoney(e.amount))
  const columns: ColumnDef<ExpenseDto>[] = [
    {
      id: "code",
      header: "Expense",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">{row.original.code}</span>
          {row.original.reversalOf && <Badge tone="gray">Void of {row.original.reversalOf.code}</Badge>}
          {row.original.reversedBy && <Badge tone="gray">Voided</Badge>}
        </div>
      ),
    },
    { id: "date", header: "Date", meta: { cellClassName: "whitespace-nowrap" }, cell: ({ row }) => formatDate(row.original.businessDate) },
    { id: "category", header: "Category", cell: ({ row }) => row.original.category.name },
    {
      id: "for",
      header: "For",
      cell: ({ row }) =>
        row.original.order ? (
          <span className="font-mono text-xs">{row.original.order.code}</span>
        ) : (
          <span className="text-faint">Operating</span>
        ),
    },
    { id: "vendor", header: "Paid to", cell: ({ row }) => row.original.vendor ?? <span className="text-faint">—</span> },
    { id: "account", header: "Paid from", cell: ({ row }) => row.original.account.name },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => signed(row.original),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Money spent running the business or on a particular order. It never counts as a sale; voids keep the original on record."
        action={
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Record expense
          </Button>
        }
      />
      <ExpenseTabs />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/expenses", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Expense, paid to, reference" />
        <FilterSelect label="Category" value={f.categoryId} onChange={(categoryId) => update({ filters: { categoryId } })}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Type" value={f.kind} onChange={(kind) => update({ filters: { kind: kind as ExpenseKind | undefined } })}>
          <option value="">All types</option>
          {EXPENSE_KINDS.map((k) => (
            <option key={k} value={k}>
              {EXPENSE_KIND_LABELS[k]}
            </option>
          ))}
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
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onRowClick={(e) => setOpenId(e.id)}
        getRowId={(e) => e.id}
        emptyTitle="No expenses recorded"
        mobileCard={(e) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{e.category.name}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{e.code}</span> · {formatDate(e.businessDate)} · {e.account.name}
              </p>
            </div>
            <p className="text-sm font-semibold tabular">{signed(e)}</p>
          </div>
        )}
      />
      {adding && <ExpenseModal onClose={() => setAdding(false)} />}
      {openId && <ExpenseDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
