"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { REFUND_METHOD_LABELS, RETURN_CONDITION_LABELS, type SalesReturnListItemDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, DetailRow, PageHeader, Skeleton } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { StockDocumentModal } from "../inventory/StockModals"
import { useOrder } from "../sales/api"
import OrderPicker from "../sales/OrderPicker"
import { useReturn, useReturns } from "./api"
import ReturnModal from "./ReturnModal"

type Filters = { from?: string; to?: string }

export function ReturnDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useReturn(id)
  const [documentId, setDocumentId] = useState<string | null>(null)
  if (!data) return null
  if (documentId) return <StockDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} onOpenDocument={setDocumentId} />
  return (
    <Modal title={`${data.code} · return from ${data.orderCode}`} onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {data.lines.map((l) => (
            <li key={l.orderLineId} className="flex items-start gap-3 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {l.quantity} × {l.productName} — {l.variantName}
                </p>
                <p className="text-xs text-faint">{RETURN_CONDITION_LABELS[l.condition]}</p>
              </div>
              <span className="tabular">{formatMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
        <dl>
          {Number(data.shippingRefund) > 0 && <DetailRow label="Shipping refunded">{formatMoney(data.shippingRefund)}</DetailRow>}
          <DetailRow label="Value returned">{formatMoney(data.amount)}</DetailRow>
          <DetailRow label="GST reversed">{formatMoney(data.gstAmount)}</DetailRow>
          <DetailRow label="Money back">
            {REFUND_METHOD_LABELS[data.refundMethod]}
            {data.refundMethod !== "NONE" && ` · ${formatMoney(data.refundAmount)}`}
            {data.refundPayment && ` · ${data.refundPayment.code} from ${data.refundPayment.accountName}`}
          </DetailRow>
          <DetailRow label="Restocked at">{data.locationName}</DetailRow>
          {data.stockDocument && (
            <DetailRow label="Stock entry">
              <button className="font-mono text-primary hover:underline" onClick={() => setDocumentId(data.stockDocument!.id)}>
                {data.stockDocument.code}
              </button>
            </DetailRow>
          )}
          <DetailRow label="Reason">{data.reason}</DetailRow>
          <DetailRow label="Recorded">
            {formatDateTime(data.createdAt)} by {data.createdByName ?? "—"}
          </DetailRow>
        </dl>
      </div>
    </Modal>
  )
}

export const RefundBadge = ({ r }: { r: SalesReturnListItemDto }) =>
  r.refundMethod === "NONE" ? (
    <Badge tone="gray">No refund</Badge>
  ) : (
    <Badge tone={r.refundMethod === "REFUND" ? "red" : "purple"}>
      {r.refundMethod === "REFUND" ? "Refunded" : "Credit"} {formatMoney(r.refundAmount)}
    </Badge>
  )

export default function ReturnsList() {
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = useReturns(params)
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [returnFor, setReturnFor] = useState<string | null>(null)
  const can = useCan()
  const f = state.filters

  const columns: ColumnDef<SalesReturnListItemDto>[] = [
    { id: "code", header: "Return", cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.code}</span> },
    { id: "date", header: "Date", meta: { cellClassName: "whitespace-nowrap" }, cell: ({ row }) => formatDate(row.original.businessDate) },
    {
      id: "order",
      header: "Order",
      cell: ({ row }) => (
        <Link href={`/sales/${row.original.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs hover:text-primary">
          {row.original.orderCode}
        </Link>
      ),
    },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? <span className="text-faint">Walk-in</span> },
    { id: "reason", header: "Reason", meta: { cellClassName: "max-w-64 truncate" }, cell: ({ row }) => row.original.reason },
    { id: "units", header: "Items", meta: { align: "right", cellClassName: "tabular" }, cell: ({ row }) => row.original.units },
    {
      id: "amount",
      header: "Value",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    { id: "refund", header: "Money back", cell: ({ row }) => <RefundBadge r={row.original} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Goods back from fulfilled orders, with the refund or store credit that went with them."
        action={
          can("sales.manage") && (
            <Button icon={<Plus size={16} />} onClick={() => setPicking(true)}>
              New return
            </Button>
          )
        }
      />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/returns", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Return, order, customer or reason" />
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
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        emptyTitle="No returns"
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{r.customer?.name ?? "Walk-in"}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{r.code}</span> · {r.orderCode} · {formatDate(r.businessDate)}
              </p>
            </div>
            <p className="text-sm font-semibold tabular">{formatMoney(r.amount)}</p>
          </div>
        )}
      />
      {openId && <ReturnDetailModal id={openId} onClose={() => setOpenId(null)} />}
      {picking && (
        <OrderPicker
          readyFor="return"
          title="New return"
          hint="Pick the fulfilled order the goods came back from."
          empty="No fulfilled orders yet."
          onClose={() => setPicking(false)}
          onPick={(order) => {
            setPicking(false)
            setReturnFor(order.id)
          }}
        />
      )}
      {returnFor && <ReturnForOrder id={returnFor} onClose={() => setReturnFor(null)} />}
    </div>
  )
}

/** The return form needs the order's lines, so it opens once they've loaded. */
function ReturnForOrder({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useOrder(id)
  if (!data) {
    return (
      <Modal title="New return" onClose={onClose}>
        <Skeleton className="h-40 rounded-xl" />
      </Modal>
    )
  }
  return <ReturnModal order={data} onClose={onClose} />
}
