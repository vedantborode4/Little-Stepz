"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, Boxes, PackageCheck, PackageX, Wallet } from "lucide-react"
import { useState } from "react"
import { STOCK_STATES, type StockRowDto, type StockState } from "@repo/crm-schema"
import DataTable from "@/components/ui/DataTable"
import { PageHeader, StatCard } from "@/components/ui/Display"
import { Checkbox } from "@/components/ui/Form"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatMoney, formatQty } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useNamedList } from "../products/api"
import { ProductThumb } from "../products/shared"
import { useLocations } from "../settings/api"
import { useStock, useStockSummary } from "./api"
import { InventoryTabs, StockStateBadge } from "./shared"
import { StockCardModal, StockDocumentModal } from "./StockModals"

const STATE_LABELS: Record<StockState, string> = { OK: "In stock", LOW: "Low stock", OUT: "Out of stock" }

type Filters = { categoryId?: string; locationId?: string; state?: StockState; includeEmpty?: "true" | "false" }

export default function StockLevels() {
  const { state, update, params } = useListState<Filters>({ sort: "product:asc", filters: { includeEmpty: "true" } })
  const { data, isLoading } = useStock(params)
  const summary = useStockSummary()
  const categories = useNamedList("categories")
  const locations = useLocations()
  const [cardFor, setCardFor] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const showCosts = summary.data?.stockValue !== undefined
  const s = summary.data

  const columns: ColumnDef<StockRowDto>[] = [
    {
      id: "product",
      header: "Item",
      meta: { sortKey: "product" },
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-[14rem]">
          <ProductThumb src={row.original.imageUrl} alt={row.original.productName} size={36} />
          <div className="min-w-0">
            <p className="font-medium truncate">{row.original.productName}</p>
            <p className="text-xs text-muted">
              {row.original.variantName} · <span className="font-mono">{row.original.sku}</span>
            </p>
          </div>
        </div>
      ),
    },
    ...(locations.data ?? []).map(
      (loc): ColumnDef<StockRowDto> => ({
        id: `loc-${loc.id}`,
        header: loc.name,
        meta: { align: "right", cellClassName: "tabular" },
        cell: ({ row }) => row.original.byLocation.find((l) => l.locationId === loc.id)?.sellable ?? 0,
      }),
    ),
    {
      id: "damaged",
      header: "Damaged",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => row.original.damaged || "—",
    },
    {
      id: "demo",
      header: "Demo",
      meta: { align: "right", cellClassName: "tabular", defaultHidden: true },
      cell: ({ row }) => row.original.demo || "—",
    },
    {
      id: "physical",
      header: "Physical",
      meta: { sortKey: "physical", align: "right", cellClassName: "tabular" },
      cell: ({ row }) => row.original.physical,
    },
    {
      id: "available",
      header: "Available",
      meta: { sortKey: "available", align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => row.original.available,
    },
    ...(showCosts
      ? [
          {
            id: "cost",
            header: "Avg cost",
            meta: { align: "right" as const, cellClassName: "tabular" },
            cell: ({ row }: { row: { original: StockRowDto } }) =>
              row.original.avgUnitCost ? formatMoney(row.original.avgUnitCost) : <span className="text-faint">—</span>,
          },
          {
            id: "value",
            header: "Value",
            meta: { align: "right" as const, cellClassName: "tabular" },
            cell: ({ row }: { row: { original: StockRowDto } }) => (
              <span title={row.original.unvaluedQty ? `${row.original.unvaluedQty} units with unknown cost not included` : undefined}>
                {formatMoney(row.original.stockValue)}
                {(row.original.unvaluedQty ?? 0) > 0 && <span className="text-yellow-600"> *</span>}
              </span>
            ),
          },
        ]
      : []),
    { id: "state", header: "Status", cell: ({ row }) => <StockStateBadge state={row.original.state} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Available = sellable stock minus reserved units. Damaged and demo units are physical but not sellable."
      />
      <InventoryTabs />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5">
        <StatCard
          title="Physical units"
          value={formatQty(s?.physical)}
          hint={s ? `${s.variants} variants` : undefined}
          icon={<Boxes size={18} />}
        />
        <StatCard
          title="Available units"
          value={formatQty(s?.available)}
          hint={s ? `${s.damaged} damaged · ${s.demo} demo` : undefined}
          icon={<PackageCheck size={18} />}
          color="bg-green-50 dark:bg-green-500/15 text-green-600"
        />
        <button className="text-left" onClick={() => update({ filters: { state: "LOW" } })}>
          <StatCard
            title="Low / out of stock"
            value={s ? `${s.lowStock} / ${s.outOfStock}` : "—"}
            hint="Tap to see low stock"
            icon={<AlertTriangle size={18} />}
            color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
          />
        </button>
        {showCosts ? (
          <StatCard
            title="Inventory cost value"
            value={formatMoney(s?.stockValue)}
            hint={s?.unvaluedQty ? `${s.unvaluedQty} units with unknown cost not included` : "At weighted average landed cost"}
            icon={<Wallet size={18} />}
            color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
          />
        ) : (
          <StatCard
            title="Out of stock"
            value={s?.outOfStock ?? "—"}
            icon={<PackageX size={18} />}
            color="bg-red-50 dark:bg-red-500/15 text-red-500"
          />
        )}
      </div>

      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/inventory/stock", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Search product or SKU" />
        <FilterSelect label="Category" value={state.filters.categoryId} onChange={(categoryId) => update({ filters: { categoryId } })}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Location" value={state.filters.locationId} onChange={(locationId) => update({ filters: { locationId } })}>
          <option value="">All locations</option>
          {locations.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Stock status"
          value={state.filters.state}
          onChange={(st) => update({ filters: { state: st as StockState | undefined } })}
        >
          <option value="">Any status</option>
          {STOCK_STATES.map((st) => (
            <option key={st} value={st}>
              {STATE_LABELS[st]}
            </option>
          ))}
        </FilterSelect>
        <Checkbox
          id="hide-empty"
          label="Hide items with no stock"
          checked={state.filters.includeEmpty === "false"}
          onChange={(e) => update({ filters: { includeEmpty: e.target.checked ? "false" : "true" } })}
        />
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
        onRowClick={(r) => setCardFor(r.variantId)}
        getRowId={(r) => r.variantId}
        emptyTitle="No items match"
        emptyHint="Record opening stock under Record movement to start tracking an item."
        mobileCard={(r) => (
          <div className="flex items-start gap-3">
            <ProductThumb src={r.imageUrl} alt={r.productName} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{r.productName}</p>
              <p className="text-xs text-muted">
                {r.variantName} · <span className="font-mono">{r.sku}</span>
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <StockStateBadge state={r.state} />
                <span className="text-xs text-muted">{r.byLocation.map((l) => `${l.locationCode} ${l.sellable}`).join(" · ")}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular">{r.available}</p>
              <p className="text-[10px] text-faint uppercase">available</p>
            </div>
          </div>
        )}
      />
      {cardFor && (
        <StockCardModal
          variantId={cardFor}
          onClose={() => setCardFor(null)}
          onOpenDocument={(id) => {
            setCardFor(null)
            setDocumentId(id)
          }}
        />
      )}
      {documentId && <StockDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} onOpenDocument={setDocumentId} />}
    </div>
  )
}
