"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowRight, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { AccountTransferDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader } from "@/components/ui/Display"
import { Field, FormError, Input, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney, todayIST } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useCreateTransfer, useReverseTransfer, useTransfers } from "./api"
import { AccountSelect, PaymentTabs } from "./shared"

function TransferModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTransfer()
  const [fromAccountId, setFrom] = useState("")
  const [toAccountId, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Move money between accounts"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!fromAccountId || !toAccountId || !amount}
            onClick={async () => {
              setError(null)
              try {
                await create.mutateAsync({
                  fromAccountId,
                  toAccountId,
                  amount,
                  businessDate,
                  reference: reference || null,
                  notes: notes || null,
                })
                toast.success("Transfer recorded")
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Record transfer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <p className="text-sm text-muted">
          For cash deposited to the bank, or personal UPI moved to the business account. It isn&apos;t a sale or an expense.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="From" htmlFor="tr-from" required>
            <AccountSelect id="tr-from" value={fromAccountId} onChange={setFrom} />
          </Field>
          <Field label="To" htmlFor="tr-to" required>
            <AccountSelect id="tr-to" value={toAccountId} onChange={setTo} />
          </Field>
          <Field label="Amount (₹)" htmlFor="tr-amount" required>
            <Input id="tr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="tr-date">
            <Input id="tr-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Reference" htmlFor="tr-ref" hint="Deposit slip or UTR">
          <Input id="tr-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="tr-notes">
          <Textarea id="tr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ReverseDialog({ transfer, onClose }: { transfer: AccountTransferDto; onClose: () => void }) {
  const reverse = useReverseTransfer(transfer.id)
  const [reason, setReason] = useState("")
  return (
    <ConfirmDialog
      title={`Reverse ${transfer.code}?`}
      message={
        <div className="space-y-3">
          <p>
            Records the opposite move: {formatMoney(transfer.amount)} back from {transfer.to.name} to {transfer.from.name}.
          </p>
          <Field label="Reason" htmlFor="rev-reason" required>
            <Textarea id="rev-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
      confirmLabel="Reverse"
      confirmDisabled={!reason.trim()}
      loading={reverse.isPending}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await reverse.mutateAsync(reason.trim())
          toast.success("Transfer reversed")
          onClose()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
    />
  )
}

export default function Transfers() {
  const can = useCan()
  const { state, update, params } = useListState()
  const { data, isLoading } = useTransfers(params)
  const [creating, setCreating] = useState(false)
  const [reversing, setReversing] = useState<AccountTransferDto | null>(null)
  const canTransfer = can("payments.transfer")

  const columns: ColumnDef<AccountTransferDto>[] = [
    {
      id: "code",
      header: "Transfer",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{row.original.code}</span>
          {row.original.reversalOf && <Badge tone="gray">Reverses {row.original.reversalOf.code}</Badge>}
          {row.original.reversedBy && <Badge tone="gray">Reversed</Badge>}
        </div>
      ),
    },
    { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.businessDate) },
    {
      id: "route",
      header: "From → to",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          {row.original.from.name} <ArrowRight size={13} className="text-faint" /> {row.original.to.name}
        </span>
      ),
    },
    { id: "reference", header: "Reference", cell: ({ row }) => row.original.reference ?? <span className="text-faint">—</span> },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) =>
        canTransfer && !row.original.reversalOf && !row.original.reversedBy ? (
          <Button variant="ghost" size="sm" onClick={() => setReversing(row.original)}>
            Reverse
          </Button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Money moved between your own accounts. Never counted as sales, refunds or expenses."
        action={
          canTransfer && (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New transfer
            </Button>
          )
        }
      />
      <PaymentTabs />
      <ListToolbar>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Transfer or reference" />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        getRowId={(t) => t.id}
        emptyTitle="No transfers yet"
        mobileCard={(t) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {t.from.name} → {t.to.name}
              </p>
              <p className="text-xs text-muted">
                <span className="font-mono">{t.code}</span> · {formatDate(t.businessDate)}
              </p>
            </div>
            <p className="text-sm font-semibold tabular">{formatMoney(t.amount)}</p>
          </div>
        )}
      />
      {creating && <TransferModal onClose={() => setCreating(false)} />}
      {reversing && <ReverseDialog transfer={reversing} onClose={() => setReversing(null)} />}
    </div>
  )
}
