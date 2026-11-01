"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  SUPPLIER_BALANCE_DIRECTION_LABELS,
  SUPPLIER_BALANCE_DIRECTIONS,
  SUPPLIER_ENTRY_TYPE_HINTS,
  SUPPLIER_ENTRY_TYPE_LABELS,
  SUPPLIER_ENTRY_TYPES,
  SUPPLIER_ENTRY_TYPES_WITH_ACCOUNT,
  SUPPLIER_ENTRY_TYPES_WITH_DIRECTION,
  type SupplierBalanceDirection,
  type SupplierDto,
  type SupplierEntryType,
  type SupplierLedgerEntryDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, DetailRow, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatDate, formatDateTime, formatMoney, todayIST } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { AccountSelect } from "../payments/shared"
import { usePurchases, useRecordSupplierEntry, useSupplier, useSupplierEntry, useSupplierLedger, useVoidSupplierEntry } from "./api"
import { BalanceBadge, balanceWords, PurchaseTabs } from "./shared"
import { SupplierModal } from "./SuppliersPanel"

const signedMoney = (amount: string) => (Number(amount) > 0 ? `+${formatMoney(amount)}` : `−${formatMoney(amount.replace("-", ""))}`)

function RecordEntryModal({ supplier, balance, onClose }: { supplier: SupplierDto; balance: string; onClose: () => void }) {
  const record = useRecordSupplierEntry(supplier.id)
  const [type, setType] = useState<SupplierEntryType>("PAYMENT")
  const [direction, setDirection] = useState<SupplierBalanceDirection>("OURS")
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [purchaseId, setPurchaseId] = useState("")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const purchases = usePurchases({ supplierId: supplier.id, status: "RECEIVED", limit: 50, sort: "invoiceDate:desc" })

  const needsAccount = SUPPLIER_ENTRY_TYPES_WITH_ACCOUNT.includes(type)
  const needsDirection = SUPPLIER_ENTRY_TYPES_WITH_DIRECTION.includes(type)
  const raises = type === "PAYMENT" || type === "CREDIT_NOTE" || (needsDirection && direction === "OURS")
  const value = Number(amount)
  const after = value > 0 ? (Number(balance) + (raises ? value : -value)).toFixed(2) : null

  return (
    <Modal
      title={`Record for ${supplier.name}`}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={record.isPending}
            disabled={!amount || (needsAccount && !accountId) || (type === "ADJUSTMENT" && !notes.trim())}
            onClick={async () => {
              setError(null)
              try {
                await record.mutateAsync({
                  type,
                  amount,
                  direction: needsDirection ? direction : undefined,
                  accountId: needsAccount ? accountId : null,
                  purchaseId: type === "GOODS_RECEIVED" ? purchaseId || null : null,
                  businessDate,
                  reference: reference || null,
                  notes: notes || null,
                })
                toast.success(`${SUPPLIER_ENTRY_TYPE_LABELS[type]} recorded`)
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
        <Field label="What happened" htmlFor="se-type" hint={SUPPLIER_ENTRY_TYPE_HINTS[type]}>
          <Select id="se-type" value={type} onChange={(e) => setType(e.target.value as SupplierEntryType)}>
            {SUPPLIER_ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {SUPPLIER_ENTRY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {needsDirection && (
            <Field label="Which way" htmlFor="se-direction" className="sm:col-span-2">
              <Select id="se-direction" value={direction} onChange={(e) => setDirection(e.target.value as SupplierBalanceDirection)}>
                {SUPPLIER_BALANCE_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {SUPPLIER_BALANCE_DIRECTION_LABELS[d]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Amount (₹)" htmlFor="se-amount" required>
            <Input id="se-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="se-date">
            <Input id="se-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
          {needsAccount && (
            <Field label={type === "PAYMENT" ? "Paid from" : "Received into"} htmlFor="se-account" required className="sm:col-span-2">
              <AccountSelect id="se-account" value={accountId} onChange={setAccountId} />
            </Field>
          )}
          {type === "GOODS_RECEIVED" && (
            <Field label="Purchase (optional)" htmlFor="se-purchase" className="sm:col-span-2">
              <Select id="se-purchase" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                <option value="">Not in the CRM / not linked</option>
                {purchases.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {formatDate(p.invoiceDate)}
                    {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Reference" htmlFor="se-ref" hint="Bill, UTR or chat note" className="sm:col-span-2">
            <Input id="se-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="se-notes" required={type === "ADJUSTMENT"} className="sm:col-span-2">
            <Textarea id="se-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {after !== null && (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
            Balance after this: <span className="font-semibold">{balanceWords(after)}</span>
          </p>
        )}
      </div>
    </Modal>
  )
}

function EntryDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useSupplierEntry(id)
  const voidIt = useVoidSupplierEntry(id)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState("")
  if (!data) return null
  const canVoid = !data.reversalOf && !data.reversedBy
  return (
    <Modal
      title={`${data.code} · ${SUPPLIER_ENTRY_TYPE_LABELS[data.type]}`}
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
                  toast.success("Entry voided")
                  onClose()
                } catch (err) {
                  toast.error(errorMessage(err))
                }
              }}
            >
              Void entry
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
        <div className="space-y-3">
          <p className="text-sm text-muted">
            A void adds an opposite entry dated today; this one stays on record.
            {data.account && ` Today's ${data.account.name} total changes by the same amount.`}
          </p>
          <Field label="Why is this being voided?" htmlFor="void-reason" required>
            <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      ) : (
        <dl>
          <DetailRow label="Amount">{signedMoney(data.amount)}</DetailRow>
          <DetailRow label="Balance after">{balanceWords(data.balanceAfter)}</DetailRow>
          <DetailRow label="Date">{formatDate(data.businessDate)}</DetailRow>
          {data.account && <DetailRow label="Account">{data.account.name}</DetailRow>}
          {data.purchase && (
            <DetailRow label="Purchase">
              <Link href={`/purchases/${data.purchase.id}`} className="text-primary hover:underline">
                {data.purchase.code}
              </Link>
            </DetailRow>
          )}
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

type Filters = { type?: SupplierEntryType }

function Ledger({ supplier, onRecord }: { supplier: SupplierDto; onRecord: () => void }) {
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = useSupplierLedger(supplier.id, params)
  const [openId, setOpenId] = useState<string | null>(null)
  const summary = data?.summary
  const t = summary?.totals

  const columns: ColumnDef<SupplierLedgerEntryDto>[] = [
    { id: "date", header: "Date", meta: { cellClassName: "whitespace-nowrap" }, cell: ({ row }) => formatDate(row.original.businessDate) },
    {
      id: "what",
      header: "What",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span>{SUPPLIER_ENTRY_TYPE_LABELS[row.original.type]}</span>
          <span className="font-mono text-xs text-primary">{row.original.code}</span>
          {row.original.reversalOf && <Badge tone="gray">Void of {row.original.reversalOf.code}</Badge>}
          {row.original.reversedBy && <Badge tone="gray">Voided</Badge>}
        </div>
      ),
    },
    {
      id: "via",
      header: "Account / purchase",
      cell: ({ row }) => row.original.account?.name ?? row.original.purchase?.code ?? <span className="text-faint">—</span>,
    },
    {
      id: "reference",
      header: "Reference",
      cell: ({ row }) => row.original.reference ?? row.original.notes ?? <span className="text-faint">—</span>,
    },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right", cellClassName: "tabular font-semibold whitespace-nowrap" },
      cell: ({ row }) => signedMoney(row.original.amount),
    },
    {
      id: "balance",
      header: "Balance after",
      meta: { align: "right", cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => <BalanceBadge balance={row.original.balanceAfter} />,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {isLoading || !summary || !t ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Balance"
              value={<BalanceBadge balance={summary.balance} />}
              hint={summary.lastEntryDate ? `Last entry ${formatDate(summary.lastEntryDate)}` : "No entries yet"}
            />
            <StatCard title="Paid to them" value={formatMoney(t.PAYMENT)} hint="Payments, net of voids" />
            <StatCard title="Goods received" value={formatMoney(t.GOODS_RECEIVED.replace("-", ""))} hint="Value of goods and bills" />
            <StatCard
              title="Opening & other"
              value={signedMoney((Number(t.OPENING) + Number(t.ADJUSTMENT) + Number(t.CREDIT_NOTE) + Number(t.REFUND)).toFixed(2))}
              hint="Opening, refunds, credit and adjustments"
            />
          </>
        )}
      </div>

      <Card title="Ledger">
        <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport(`/suppliers/${supplier.id}/ledger`, params, format)} />}>
          <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Entry, reference or note" />
          <FilterSelect
            label="Type"
            value={state.filters.type}
            onChange={(type) => update({ filters: { type: type as SupplierEntryType | undefined } })}
          >
            <option value="">All entries</option>
            {SUPPLIER_ENTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {SUPPLIER_ENTRY_TYPE_LABELS[type]}
              </option>
            ))}
          </FilterSelect>
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
          emptyTitle="Nothing recorded with this supplier"
          emptyHint="Start with the opening balance: what they held of yours, or what you owed them, before the CRM."
          emptyAction={
            <Button icon={<Plus size={16} />} onClick={onRecord}>
              Record an entry
            </Button>
          }
          mobileCard={(e) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {SUPPLIER_ENTRY_TYPE_LABELS[e.type]}
                  {e.reversalOf && <span className="text-faint font-normal"> · void</span>}
                  {e.reversedBy && <span className="text-faint font-normal"> · voided</span>}
                </p>
                <p className="text-xs text-muted truncate">
                  <span className="font-mono">{e.code}</span> · {formatDate(e.businessDate)}
                  {e.account && ` · ${e.account.name}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular">{signedMoney(e.amount)}</p>
                <p className="text-xs">
                  <BalanceBadge balance={e.balanceAfter} />
                </p>
              </div>
            </div>
          )}
        />
      </Card>
      {openId && <EntryDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

export default function SupplierDetail({ id }: { id: string }) {
  const can = useCan()
  const { data: supplier, isLoading } = useSupplier(id)
  const ledgerAllowed = can("suppliers.ledger")
  const [editing, setEditing] = useState(false)
  const [recording, setRecording] = useState(false)

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!supplier) return <EmptyState title="Supplier not found" />

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <PageHeader
          title={supplier.name}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Link href="/purchases/suppliers" className="inline-flex items-center gap-1 text-primary hover:underline">
                <ArrowLeft size={13} /> Suppliers
              </Link>
              {[supplier.country, supplier.currency].filter(Boolean).join(" · ")}
              {!supplier.isActive && <Badge tone="gray">Inactive</Badge>}
            </span>
          }
          action={
            <>
              <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              {ledgerAllowed && (
                <Button icon={<Plus size={16} />} onClick={() => setRecording(true)}>
                  Record entry
                </Button>
              )}
            </>
          }
        />
        <PurchaseTabs />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="2xl:col-span-2">
          {ledgerAllowed ? (
            <Ledger supplier={supplier} onRecord={() => setRecording(true)} />
          ) : (
            <EmptyState title="Supplier balances are for the owner" hint="Ask an admin for what this supplier holds or is owed." />
          )}
        </div>
        <Card title="Details">
          <dl>
            <DetailRow label="Contact">{supplier.contactName ?? "—"}</DetailRow>
            <DetailRow label="Phone / WeChat">{supplier.phone ?? "—"}</DetailRow>
            <DetailRow label="Email">{supplier.email ?? "—"}</DetailRow>
            <DetailRow label="GSTIN">{supplier.gstin ?? "—"}</DetailRow>
            <DetailRow label="Address">{supplier.address ?? "—"}</DetailRow>
            {supplier.notes && <DetailRow label="Notes">{supplier.notes}</DetailRow>}
          </dl>
        </Card>
      </div>

      {editing && <SupplierModal supplier={supplier} onClose={() => setEditing(false)} />}
      {recording && <RecordEntryModal supplier={supplier} balance={supplier.balance ?? "0"} onClose={() => setRecording(false)} />}
    </div>
  )
}
