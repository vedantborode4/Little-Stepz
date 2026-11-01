"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { createSupplierSchema, CURRENCIES, type SupplierDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { useApiForm } from "@/lib/use-api-form"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useSuppliers } from "../products/api"
import { useSaveSupplier } from "./api"
import { BalanceBadge, PurchaseTabs } from "./shared"

export function SupplierModal({ supplier, onClose }: { supplier: SupplierDto | null; onClose: () => void }) {
  const save = useSaveSupplier()
  const { form, formError, submitWith } = useApiForm(createSupplierSchema, {
    name: supplier?.name ?? "",
    country: supplier?.country ?? "",
    currency: supplier?.currency ?? "INR",
    contactName: supplier?.contactName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    gstin: supplier?.gstin ?? "",
    notes: supplier?.notes ?? "",
    isActive: supplier?.isActive ?? true,
  })
  const { register, formState } = form
  const e = formState.errors

  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ id: supplier?.id, input: values })
    toast.success(supplier ? "Supplier updated" : "Supplier added")
    onClose()
  })

  return (
    <Modal
      title={supplier ? `Edit ${supplier.name}` : "New supplier"}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Field label="Name" htmlFor="s-name" required error={e.name?.message} className="sm:col-span-2">
          <Input id="s-name" {...register("name")} />
        </Field>
        <Field label="Country" htmlFor="s-country" error={e.country?.message}>
          <Input id="s-country" {...register("country")} />
        </Field>
        <Field label="Invoice currency" htmlFor="s-currency">
          <Select id="s-currency" {...register("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact person" htmlFor="s-contact" error={e.contactName?.message}>
          <Input id="s-contact" {...register("contactName")} />
        </Field>
        <Field label="Phone / WeChat" htmlFor="s-phone" error={e.phone?.message}>
          <Input id="s-phone" {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="s-email" error={e.email?.message}>
          <Input id="s-email" type="email" {...register("email")} />
        </Field>
        <Field label="GSTIN (Indian suppliers)" htmlFor="s-gstin" error={e.gstin?.message}>
          <Input id="s-gstin" className="uppercase" {...register("gstin")} />
        </Field>
        <Field label="Address" htmlFor="s-address" error={e.address?.message} className="sm:col-span-2">
          <Textarea id="s-address" rows={2} {...register("address")} />
        </Field>
        <Field label="Notes" htmlFor="s-notes" error={e.notes?.message} className="sm:col-span-2">
          <Textarea id="s-notes" rows={2} {...register("notes")} />
        </Field>
      </form>
    </Modal>
  )
}

export default function SuppliersPanel() {
  const can = useCan()
  const [showInactive, setShowInactive] = useState(false)
  const { state, update, params } = useListState({ sort: "name:asc" })
  const { data, isLoading } = useSuppliers({ ...params, includeInactive: showInactive })
  const save = useSaveSupplier()
  const [editing, setEditing] = useState<SupplierDto | null | undefined>(undefined)
  const [toggling, setToggling] = useState<SupplierDto | null>(null)

  const columns: ColumnDef<SupplierDto>[] = [
    {
      id: "name",
      header: "Supplier",
      meta: { sortKey: "name", cellClassName: "font-medium" },
      cell: ({ row }) => (
        <Link href={`/purchases/suppliers/${row.original.id}`} className="text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "country",
      header: "Country",
      meta: { sortKey: "country" },
      cell: ({ row }) => row.original.country ?? <span className="text-faint">—</span>,
    },
    { id: "currency", header: "Currency", cell: ({ row }) => row.original.currency },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) =>
        [row.original.contactName, row.original.phone].filter(Boolean).join(" · ") || <span className="text-faint">—</span>,
    },
    ...(can("suppliers.ledger")
      ? [
          {
            id: "balance",
            header: "Balance",
            meta: { cellClassName: "whitespace-nowrap" },
            cell: ({ row }) => <BalanceBadge balance={row.original.balance ?? "0"} />,
          } satisfies ColumnDef<SupplierDto>,
        ]
      : []),
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge tone={row.original.isActive ? "green" : "gray"}>{row.original.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(row.original)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setToggling(row.original)}>
            {row.original.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Purchases & Shipments"
        subtitle="Suppliers you buy from, the currency they invoice in, and what they hold of yours or you owe them."
      />
      <PurchaseTabs />
      <ListToolbar
        actions={
          <>
            <ExportMenu onExport={(format) => downloadExport("/suppliers", { ...params, includeInactive: showInactive }, format)} />
            <Button icon={<Plus size={16} />} onClick={() => setEditing(null)}>
              Add supplier
            </Button>
          </>
        }
      >
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Search name, contact or country" />
        <Checkbox id="sup-inactive" label="Show inactive" checked={showInactive} onChange={(ev) => setShowInactive(ev.target.checked)} />
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
        getRowId={(s) => s.id}
        emptyTitle="No suppliers yet"
        mobileCard={(s) => (
          <div className="flex items-start justify-between gap-3">
            <Link href={`/purchases/suppliers/${s.id}`} className="min-w-0">
              <p className="text-sm font-semibold text-primary">{s.name}</p>
              <p className="text-xs text-muted">{[s.country, s.currency, s.contactName].filter(Boolean).join(" · ")}</p>
              {s.balance !== undefined && (
                <p className="text-xs mt-0.5">
                  <BalanceBadge balance={s.balance} />
                </p>
              )}
            </Link>
            <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
              Edit
            </Button>
          </div>
        )}
      />
      {editing !== undefined && <SupplierModal supplier={editing} onClose={() => setEditing(undefined)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling.name}?`}
          message={
            toggling.isActive
              ? "They won't be offered for new purchases. Past purchases keep them."
              : "They'll be offered for new purchases again."
          }
          confirmLabel={toggling.isActive ? "Deactivate" : "Reactivate"}
          tone={toggling.isActive ? "danger" : "primary"}
          loading={save.isPending}
          onCancel={() => setToggling(null)}
          onConfirm={async () => {
            try {
              await save.mutateAsync({ id: toggling.id, input: { isActive: !toggling.isActive } })
              setToggling(null)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        />
      )}
    </div>
  )
}
