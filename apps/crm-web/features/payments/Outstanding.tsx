"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { AGEING_BUCKETS, type AgeingBucket, type OutstandingRowDto } from "@repo/crm-schema"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader, StatCard } from "@/components/ui/Display"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDate, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { OrderStatusBadge } from "../sales/shared"
import { useOutstanding, useOutstandingSummary } from "./api"
import { PaymentTabs } from "./shared"

type Filters = { bucket?: AgeingBucket }

const BUCKET_LABELS: Record<AgeingBucket, string> = { "0-30": "0–30 days", "31-60": "31–60 days", "60+": "Over 60 days" }

export default function Outstanding() {
  const router = useRouter()
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = useOutstanding(params)
  const summary = useOutstandingSummary({})

  const columns: ColumnDef<OutstandingRowDto>[] = [
    { id: "code", header: "Order", cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.code}</span> },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? <span className="text-faint">Walk-in</span> },
    {
      id: "orderDate",
      header: "Order date",
      meta: { cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.orderDate),
    },
    {
      id: "dueDate",
      header: "Due",
      meta: { cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => (
        <span className={row.original.overdue ? "text-red-500 font-medium" : ""}>
          {formatDate(row.original.dueDate)}
          {row.original.overdue && " · overdue"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Order",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <OrderStatusBadge status={row.original.status} />
          {!row.original.fulfilled && <Badge tone="gray">Not yet delivered</Badge>}
        </div>
      ),
    },
    {
      id: "total",
      header: "Total",
      meta: { align: "right", cellClassName: "tabular text-muted" },
      cell: ({ row }) => formatMoney(row.original.grandTotal),
    },
    {
      id: "paid",
      header: "Paid",
      meta: { align: "right", cellClassName: "tabular text-muted" },
      cell: ({ row }) => formatMoney(row.original.paid),
    },
    {
      id: "due",
      header: "Balance",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.due),
    },
    {
      id: "age",
      header: "Age",
      meta: { align: "right", cellClassName: "tabular whitespace-nowrap" },
      cell: ({ row }) => `${row.original.ageDays} d`,
    },
  ]

  const s = summary.data
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Balances still due, aged from the order date. Undelivered orders are shown but aren't receivables yet."
      />
      <PaymentTabs />
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard title="Total due" value={formatMoney(s.total)} hint={`${s.orders} orders · ${formatMoney(s.overdue)} overdue`} />
          <StatCard title="Receivable" value={formatMoney(s.receivable)} hint={`Open orders ${formatMoney(s.openOrders)}`} />
          {AGEING_BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              className="text-left"
              onClick={() => update({ filters: { bucket: state.filters.bucket === b ? undefined : b } })}
            >
              <StatCard
                title={BUCKET_LABELS[b]}
                value={formatMoney(s.buckets[b])}
                hint={state.filters.bucket === b ? "Filtered — tap to clear" : "Tap to filter"}
              />
            </button>
          ))}
        </div>
      )}
      <div>
        <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/payments/outstanding", params, format)} />}>
          <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Order or customer" />
          <FilterSelect
            label="Age"
            value={state.filters.bucket}
            onChange={(bucket) => update({ filters: { bucket: bucket as AgeingBucket | undefined } })}
          >
            <option value="">Any age</option>
            {AGEING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {BUCKET_LABELS[b]}
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
          onRowClick={(o) => router.push(`/sales/${o.orderId}`)}
          getRowId={(o) => o.orderId}
          emptyTitle="Nothing outstanding"
          emptyHint="Every confirmed order is fully paid."
          mobileCard={(o) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{o.customer?.name ?? "Walk-in"}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{o.code}</span> · {o.ageDays} days{o.overdue && " · overdue"}
                </p>
              </div>
              <p className="text-sm font-semibold tabular">{formatMoney(o.due)}</p>
            </div>
          )}
        />
      </div>
    </div>
  )
}
