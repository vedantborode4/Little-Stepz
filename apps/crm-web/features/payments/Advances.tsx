"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { SALES_ORDER_TYPE_LABELS, SALES_ORDER_TYPES, type AdvanceRowDto, type SalesOrderType } from "@repo/crm-schema"
import DataTable from "@/components/ui/DataTable"
import { PageHeader, StatCard } from "@/components/ui/Display"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { formatDate, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { OrderStatusBadge, OrderTypeBadge } from "../sales/shared"
import { useAdvances, useAdvancesSummary } from "./api"
import { PaymentTabs } from "./shared"

type Filters = { type?: SalesOrderType }

export default function Advances() {
  const router = useRouter()
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = useAdvances(params)
  const summary = useAdvancesSummary()

  const columns: ColumnDef<AdvanceRowDto>[] = [
    {
      id: "code",
      header: "Order",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">{row.original.code}</span>
          <OrderTypeBadge type={row.original.type} />
        </div>
      ),
    },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? <span className="text-faint">Walk-in</span> },
    {
      id: "orderDate",
      header: "Ordered",
      meta: { cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.orderDate),
    },
    {
      id: "expected",
      header: "Expected",
      meta: { cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.expectedArrival),
    },
    { id: "status", header: "Status", cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
    {
      id: "total",
      header: "Total",
      meta: { align: "right", cellClassName: "tabular text-muted" },
      cell: ({ row }) => formatMoney(row.original.grandTotal),
    },
    {
      id: "paid",
      header: "Advance held",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.paid),
    },
    {
      id: "due",
      header: "Balance",
      meta: { align: "right", cellClassName: "tabular text-muted" },
      cell: ({ row }) => formatMoney(row.original.due),
    },
  ]

  const s = summary.data
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Money taken for orders not yet handed over or dispatched. It's owed to customers in goods and becomes revenue only at fulfilment."
      />
      <PaymentTabs />
      {s && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          <StatCard title="Advances held" value={formatMoney(s.total)} hint={`${s.orders} orders`} />
          <StatCard title="On pre-orders" value={formatMoney(s.preOrders)} color="bg-purple-50 dark:bg-purple-500/15 text-purple-600" />
          <StatCard
            title="On other open orders"
            value={formatMoney(s.regularOrders)}
            color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
          />
        </div>
      )}
      <div>
        <ListToolbar>
          <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Order or customer" />
          <FilterSelect
            label="Type"
            value={state.filters.type}
            onChange={(type) => update({ filters: { type: type as SalesOrderType | undefined } })}
          >
            <option value="">All orders</option>
            {SALES_ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {SALES_ORDER_TYPE_LABELS[t]}
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
          emptyTitle="No advances held"
          mobileCard={(o) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{o.customer?.name ?? "Walk-in"}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{o.code}</span> · {formatDate(o.orderDate)}
                </p>
              </div>
              <p className="text-sm font-semibold tabular">{formatMoney(o.paid)}</p>
            </div>
          )}
        />
      </div>
    </div>
  )
}
