"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useState } from "react"
import {
  STOCK_DOCUMENT_TYPE_LABELS,
  STOCK_DOCUMENT_TYPES,
  STOCK_REASON_LABELS,
  type LedgerRowDto,
  type StockDocumentType,
} from "@repo/crm-schema"
import DataTable from "@/components/ui/DataTable"
import { PageHeader } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDate } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useLocations } from "../settings/api"
import { useLedger } from "./api"
import { BucketBadge, DocTypeBadge, InventoryTabs, LineCost, Qty } from "./shared"
import { StockDocumentModal } from "./StockModals"

type Filters = { type?: StockDocumentType; locationId?: string; from?: string; to?: string }

export default function Movements() {
  const { state, update, params } = useListState<Filters>({ sort: "createdAt:desc" })
  const { data, isLoading } = useLedger(params)
  const locations = useLocations(true)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const showCosts = data?.items.some((r) => r.unitCost !== undefined) ?? false
  const f = state.filters

  const columns: ColumnDef<LedgerRowDto>[] = [
    {
      id: "businessDate",
      header: "Date",
      meta: { sortKey: "businessDate", cellClassName: "whitespace-nowrap text-muted" },
      cell: ({ row }) => formatDate(row.original.businessDate),
    },
    {
      id: "doc",
      header: "Entry",
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="font-mono text-xs text-primary">{row.original.documentCode}</span>
          <div>
            <DocTypeBadge type={row.original.type} />
          </div>
        </div>
      ),
    },
    {
      id: "item",
      header: "Item",
      meta: { sortKey: "sku" },
      cell: ({ row }) => (
        <div className="min-w-[12rem]">
          <p className="font-medium">{row.original.productName}</p>
          <p className="text-xs text-muted">
            {row.original.variantName} · <span className="font-mono">{row.original.sku}</span>
          </p>
        </div>
      ),
    },
    { id: "location", header: "Location", cell: ({ row }) => row.original.locationCode },
    { id: "bucket", header: "Status", cell: ({ row }) => <BucketBadge bucket={row.original.bucket} /> },
    { id: "qty", header: "Qty", meta: { align: "right" }, cell: ({ row }) => <Qty value={row.original.quantity} /> },
    ...(showCosts
      ? [
          {
            id: "cost",
            header: "Unit cost",
            meta: { align: "right" as const, cellClassName: "tabular" },
            cell: ({ row }: { row: { original: LedgerRowDto } }) => (
              <LineCost unitCost={row.original.unitCost} effectiveType={row.original.effectiveType} />
            ),
          },
        ]
      : []),
    {
      id: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <span className="text-xs text-muted">
          {row.original.reasonCode ? `${STOCK_REASON_LABELS[row.original.reasonCode]} — ` : ""}
          {row.original.reason}
          {row.original.reference && <span className="text-faint"> · {row.original.reference}</span>}
        </span>
      ),
    },
    { id: "by", header: "By", meta: { defaultHidden: true }, cell: ({ row }) => row.original.createdByName ?? "System" },
  ]

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Every stock movement, permanently recorded. Corrections appear as reversal entries." />
      <InventoryTabs />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/inventory/ledger", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="SKU, product, entry or reference" />
        <FilterSelect label="Type" value={f.type} onChange={(type) => update({ filters: { type: type as StockDocumentType | undefined } })}>
          <option value="">All types</option>
          {STOCK_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {STOCK_DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Location" value={f.locationId} onChange={(locationId) => update({ filters: { locationId } })}>
          <option value="">All locations</option>
          {locations.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
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
        onRowClick={(r) => setDocumentId(r.documentId)}
        getRowId={(r) => r.id}
        emptyTitle="No movements match"
        mobileCard={(r) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <DocTypeBadge type={r.type} />
              <Qty value={r.quantity} />
            </div>
            <p className="text-sm font-medium">
              {r.productName} — {r.variantName}
            </p>
            <p className="text-xs text-muted">
              {r.documentCode} · {r.locationCode} · {formatDate(r.businessDate)}
            </p>
          </div>
        )}
      />
      {documentId && <StockDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} onOpenDocument={setDocumentId} />}
    </div>
  )
}
