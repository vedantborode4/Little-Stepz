"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUSES, type ProductListItemDto, type ProductStatus } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { PageHeader } from "@/components/ui/Display"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useNamedList, useProducts } from "./api"
import CatalogTabs from "./CatalogTabs"
import { MappingBadge, PriceRange, ProductStatusBadge, ProductThumb } from "./shared"

type Filters = { categoryId?: string; brandId?: string; status?: ProductStatus }

export default function ProductsList() {
  const router = useRouter()
  const can = useCan()
  const { state, update, params } = useListState<Filters>({ sort: "name:asc" })
  const { data, isLoading } = useProducts(params)
  const categories = useNamedList("categories")
  const brands = useNamedList("brands")

  const columns: ColumnDef<ProductListItemDto>[] = [
    {
      id: "name",
      header: "Product",
      meta: { sortKey: "name" },
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-[14rem]">
          <ProductThumb src={row.original.imageUrl} alt={row.original.name} />
          <div className="min-w-0">
            <p className="font-medium truncate">{row.original.name}</p>
            <p className="text-xs text-faint font-mono">{row.original.code}</p>
          </div>
        </div>
      ),
    },
    { id: "category", header: "Category", meta: { sortKey: "category" }, cell: ({ row }) => row.original.category.name },
    { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand?.name ?? <span className="text-faint">—</span> },
    {
      id: "scale",
      header: "Scale",
      meta: { defaultHidden: true },
      cell: ({ row }) => row.original.scale ?? <span className="text-faint">—</span>,
    },
    {
      id: "variants",
      header: "Variants",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => row.original.variantCount,
    },
    {
      id: "price",
      header: "Regular price",
      meta: { align: "right" },
      cell: ({ row }) => <PriceRange min={row.original.regularPriceMin} max={row.original.regularPriceMax} />,
    },
    {
      id: "offer",
      header: "Offer from",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => (row.original.offerPriceMin ? formatMoney(row.original.offerPriceMin) : <span className="text-faint">—</span>),
    },
    { id: "gst", header: "GST", meta: { defaultHidden: true, align: "right" }, cell: ({ row }) => `${row.original.gstRate}%` },
    { id: "mapping", header: "Website", cell: ({ row }) => <MappingBadge state={row.original.mapping} /> },
    { id: "status", header: "Status", cell: ({ row }) => <ProductStatusBadge status={row.original.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Every product and its variants. Prices include GST."
        action={
          can("products.manage") && (
            <Link href="/products/new">
              <Button icon={<Plus size={16} />}>Add product</Button>
            </Link>
          )
        }
      />
      <CatalogTabs />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/products", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Search name, code or SKU" />
        <FilterSelect label="Category" value={state.filters.categoryId} onChange={(categoryId) => update({ filters: { categoryId } })}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Brand" value={state.filters.brandId} onChange={(brandId) => update({ filters: { brandId } })}>
          <option value="">All brands</option>
          {brands.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={state.filters.status}
          onChange={(status) => update({ filters: { status: status as ProductStatus | undefined } })}
        >
          <option value="">All except archived</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PRODUCT_STATUS_LABELS[s]}
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
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        onRowClick={(p) => router.push(`/products/${p.id}`)}
        getRowId={(p) => p.id}
        emptyTitle="No products found"
        emptyHint="Try a different search or filter, or add your first product."
        mobileCard={(p) => (
          <div className="flex items-start gap-3">
            <ProductThumb src={p.imageUrl} alt={p.name} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">{p.name}</p>
              <p className="text-xs text-muted">
                {p.category.name} · {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-semibold">
                  <PriceRange min={p.regularPriceMin} max={p.regularPriceMax} />
                </span>
                <ProductStatusBadge status={p.status} />
              </div>
            </div>
          </div>
        )}
      />
    </div>
  )
}
