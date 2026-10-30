"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FULFILMENT_METHOD_LABELS,
  SALES_CHANNEL_LABELS,
  SALES_CHANNELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUSES,
  type SalesChannel,
  type SalesOrderListItemDto,
  type SalesOrderStatus,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { PageHeader } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDate, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useOrders } from "./api"
import { PaymentStatusBadge } from "../payments/shared"
import { OrderStatusBadge, OrderTypeBadge } from "./shared"

type Filters = { status?: SalesOrderStatus; channel?: SalesChannel; from?: string; to?: string; type?: "REGULAR" | "PRE_ORDER" }

export default function SalesList({ type, title = "Sales Orders" }: { type?: "REGULAR" | "PRE_ORDER"; title?: string }) {
  const router = useRouter()
  const can = useCan()
  const { state, update, params } = useListState<Filters>({ sort: "orderDate:desc", filters: { type } })
  const { data, isLoading } = useOrders(params)
  const f = state.filters

  const columns: ColumnDef<SalesOrderListItemDto>[] = [
    {
      id: "code",
      header: "Order",
      meta: { sortKey: "code" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">{row.original.code}</span>
          <OrderTypeBadge type={row.original.type} />
        </div>
      ),
    },
    {
      id: "orderDate",
      header: "Date",
      meta: { sortKey: "orderDate", cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.orderDate),
    },
    {
      id: "customer",
      header: "Customer",
      meta: { sortKey: "customer" },
      cell: ({ row }) => row.original.customer?.name ?? <span className="text-faint">Walk-in</span>,
    },
    { id: "channel", header: "Channel", cell: ({ row }) => SALES_CHANNEL_LABELS[row.original.channel] },
    {
      id: "fulfilment",
      header: "Fulfilment",
      meta: { defaultHidden: true },
      cell: ({ row }) => FULFILMENT_METHOD_LABELS[row.original.fulfilment],
    },
    { id: "units", header: "Items", meta: { align: "right", cellClassName: "tabular" }, cell: ({ row }) => row.original.units },
    {
      id: "grandTotal",
      header: "Total",
      meta: { sortKey: "grandTotal", align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.grandTotal),
    },
    { id: "status", header: "Status", cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
    {
      id: "payment",
      header: "Payment",
      cell: ({ row }) =>
        row.original.status === "DRAFT" ? (
          <span className="text-faint">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <PaymentStatusBadge status={row.original.paymentStatus} />
            {Number(row.original.due) > 0 && row.original.status !== "CANCELLED" && (
              <span className="text-xs text-muted tabular">{formatMoney(row.original.due)} due</span>
            )}
          </div>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Counter sales, shipped and wholesale orders. Revenue counts when an order is handed over or dispatched."
        action={
          <>
            {can("sales.create") && (
              <Link href="/pos">
                <Button variant="secondary" icon={<ShoppingCart size={15} />}>
                  POS
                </Button>
              </Link>
            )}
            {can("sales.create") && (
              <Link href={type === "PRE_ORDER" ? "/pre-orders/new" : "/sales/new"}>
                <Button icon={<Plus size={16} />}>{type === "PRE_ORDER" ? "New pre-order" : "New order"}</Button>
              </Link>
            )}
          </>
        }
      />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/sales", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Order no., reference or customer" />
        <FilterSelect
          label="Status"
          value={f.status}
          onChange={(status) => update({ filters: { status: status as SalesOrderStatus | undefined } })}
        >
          <option value="">Any status</option>
          {SALES_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SALES_ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Channel"
          value={f.channel}
          onChange={(channel) => update({ filters: { channel: channel as SalesChannel | undefined } })}
        >
          <option value="">All channels</option>
          {SALES_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {SALES_CHANNEL_LABELS[c]}
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
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        onRowClick={(o) => router.push(`/sales/${o.id}`)}
        getRowId={(o) => o.id}
        emptyTitle="No orders yet"
        emptyHint="Counter sales come from the POS; delivery and wholesale orders from New order."
        mobileCard={(o) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{o.customer?.name ?? "Walk-in"}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{o.code}</span> · {formatDate(o.orderDate)} · {o.units} items
              </p>
            </div>
            <div className="text-right space-y-1">
              <OrderStatusBadge status={o.status} />
              <p className="text-sm font-semibold tabular">{formatMoney(o.grandTotal)}</p>
            </div>
          </div>
        )}
      />
    </div>
  )
}
