"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Info, Link2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { MAPPING_STATE_LABELS, PRODUCT_MAPPING_STATES, setMappingSchema, type MappingRowDto, type MappingState } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { PageHeader } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { useApiForm } from "@/lib/use-api-form"
import { useListState } from "@/lib/use-list-state"
import { useMappings, useNamedList, useSetMapping } from "./api"
import { MappingBadge } from "./shared"

function MappingModal({ row, onClose }: { row: MappingRowDto; onClose: () => void }) {
  const save = useSetMapping()
  const { form, formError, submitWith } = useApiForm(setMappingSchema, {
    websiteProductId: row.websiteProductId ?? "",
    websiteVariantId: row.websiteVariantId ?? "",
  })
  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ variantId: row.variantId, input: values })
    toast.success(`Mapping saved for ${row.sku}`)
    onClose()
  })

  return (
    <Modal
      title={`Map ${row.sku}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="mapping-form" loading={form.formState.isSubmitting}>
            Save mapping
          </Button>
        </>
      }
    >
      <form id="mapping-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <p className="text-sm text-muted">
          {row.productName} — {row.variantName}
        </p>
        <Field
          label="Website product ID"
          htmlFor="m-product"
          error={form.formState.errors.websiteProductId?.message}
          hint="Shared by every variant of this product."
        >
          <Input id="m-product" className="font-mono" {...form.register("websiteProductId")} />
        </Field>
        <Field label="Website variant ID" htmlFor="m-variant" error={form.formState.errors.websiteVariantId?.message}>
          <Input id="m-variant" className="font-mono" {...form.register("websiteVariantId")} />
        </Field>
        <p className="text-xs text-faint">Leave a field empty to remove that link.</p>
      </form>
    </Modal>
  )
}

export default function WebsiteMapping() {
  const { state, update, params } = useListState<{ state?: MappingState; categoryId?: string }>({ sort: "product:asc" })
  const { data, isLoading } = useMappings(params)
  const categories = useNamedList("categories")
  const [editing, setEditing] = useState<MappingRowDto | null>(null)

  const columns: ColumnDef<MappingRowDto>[] = [
    {
      id: "product",
      header: "Product",
      meta: { sortKey: "product" },
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.productName}</p>
          <p className="text-xs text-muted">
            {row.original.variantName} · <span className="font-mono">{row.original.productCode}</span>
          </p>
        </div>
      ),
    },
    { id: "sku", header: "SKU", meta: { sortKey: "sku", cellClassName: "font-mono text-xs" }, cell: ({ row }) => row.original.sku },
    {
      id: "wp",
      header: "Website product ID",
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => row.original.websiteProductId ?? <span className="text-faint">—</span>,
    },
    {
      id: "wv",
      header: "Website variant ID",
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => row.original.websiteVariantId ?? <span className="text-faint">—</span>,
    },
    { id: "state", header: "State", cell: ({ row }) => <MappingBadge state={row.original.state} /> },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" icon={<Link2 size={14} />} onClick={() => setEditing(row.original)}>
          Map
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Variant Mapping"
        subtitle="Link CRM variants to their littlestepz.in product and variant IDs, and fix missing or wrong links."
      />
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 mb-4 text-sm text-blue-800 dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5" />
        <p>
          <strong>Integration placeholder — not connected.</strong> These IDs are entered by hand and kept for the future read-only website
          sync. Nothing is read from or written to littlestepz.in, and IDs are not verified against the website yet.
        </p>
      </div>
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/website-mapping", params, format)} />}>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Search SKU, product or website ID" />
        <FilterSelect
          label="Mapping state"
          value={state.filters.state}
          onChange={(s) => update({ filters: { state: s as MappingState | undefined } })}
        >
          <option value="">All states</option>
          {PRODUCT_MAPPING_STATES.map((s) => (
            <option key={s} value={s}>
              {MAPPING_STATE_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Category" value={state.filters.categoryId} onChange={(categoryId) => update({ filters: { categoryId } })}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
        getRowId={(r) => r.variantId}
        emptyTitle="No variants match"
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{r.productName}</p>
              <p className="text-xs text-muted">
                {r.variantName} · <span className="font-mono">{r.sku}</span>
              </p>
              <div className="mt-1.5">
                <MappingBadge state={r.state} />
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
              Map
            </Button>
          </div>
        )}
      />
      {editing && <MappingModal row={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
