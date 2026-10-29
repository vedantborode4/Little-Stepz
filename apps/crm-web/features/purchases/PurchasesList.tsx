"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUSES, type PurchaseListItemDto, type PurchaseStatus } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { PageHeader } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDate, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useSuppliers } from "../products/api"
import { usePurchases } from "./api"
import { PurchaseStatusBadge, PurchaseTabs } from "./shared"

type Filters = { supplierId?: string; status?: PurchaseStatus; from?: string; to?: string }

export default function PurchasesList() {
  const router = useRouter()
  const can = useCan()
  const { state, update, params } = useListState<Filters>({ sort: "invoiceDate:desc" })
  const { data, isLoading } = usePurchases(params)
  const suppliers = useSuppliers({ limit: 100, includeInactive: true })
  const showCosts = data?.items.some((r) => r.landedTotal !== undefined) ?? false
  const f = state.filters

  const columns: ColumnDef<PurchaseListItemDto>[] = [
    {
      id: "code",
      header: "Purchase",
      meta: { sortKey: "code" },
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs text-primary">{row.original.code}</p>
          <p className="text-xs text-muted">{row.original.invoiceNumber ?? "No invoice no."}</p>
        </div>
      ),
    },
    { id: "supplier", header: "Supplier", meta: { sortKey: "supplier" }, cell: ({ row }) => row.original.supplier.name },
    {
      id: "invoiceDate",
      header: "Invoice date",
      meta: { sortKey: "invoiceDate", cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.invoiceDate),
    },
    { id: "currency", header: "Currency", cell: ({ row }) => row.original.currency },
    { id: "location", header: "Receive at", meta: { defaultHidden: true }, cell: ({ row }) => row.original.locationName },
    {
      id: "units",
      header: "Units",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => `${row.original.units} (${row.original.lineCount} items)`,
    },
    ...(showCosts
      ? [
          {
            id: "landed",
            header: "Landed total",
            meta: { align: "right" as const, cellClassName: "tabular" },
            cell: ({ row }: { row: { original: PurchaseListItemDto } }) =>
              row.original.landedTotal ? formatMoney(row.original.landedTotal) : <span className="text-faint">—</span>,
          },
        ]
      : []),
    { id: "status", header: "Status", cell: ({ row }) => <PurchaseStatusBadge status={row.original.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Purchases & Shipments"
        subtitle="Supplier invoices with landed cost. Received purchases are locked; corrections are cost adjustments or returns."
        action={
          can("purchases.manage") && (
            <Link href="/purchases/new">
              <Button icon={<Plus size={16} />}>New purchase</Button>
            </Link>
          )
        }
      />
      <PurchaseTabs />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/purchases", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Code, invoice, shipment or supplier" />
        <FilterSelect label="Supplier" value={f.supplierId} onChange={(supplierId) => update({ filters: { supplierId } })}>
          <option value="">All suppliers</option>
          {suppliers.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={f.status}
          onChange={(status) => update({ filters: { status: status as PurchaseStatus | undefined } })}
        >
          <option value="">Any status</option>
          {PURCHASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PURCHASE_STATUS_LABELS[s]}
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
        onRowClick={(p) => router.push(`/purchases/${p.id}`)}
        getRowId={(p) => p.id}
        emptyTitle="No purchases yet"
        emptyHint="Record a supplier invoice or shipment to bring stock in at its landed cost."
        mobileCard={(p) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{p.supplier.name}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{p.code}</span> · {formatDate(p.invoiceDate)} · {p.units} units
              </p>
            </div>
            <div className="text-right space-y-1">
              <PurchaseStatusBadge status={p.status} />
              {p.landedTotal && <p className="text-sm font-semibold tabular">{formatMoney(p.landedTotal)}</p>}
            </div>
          </div>
        )}
      />
    </div>
  )
}
