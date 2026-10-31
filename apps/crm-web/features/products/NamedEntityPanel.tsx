"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { categorySchema, GST_RATES, type NamedEntityDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { useApiForm } from "@/lib/use-api-form"
import { useCan } from "@/store/auth.store"
import { useNamedList, useSaveNamed, type NamedKind } from "./api"

const LABELS: Record<NamedKind, { one: string; many: string }> = {
  categories: { one: "category", many: "categories" },
  brands: { one: "brand", many: "brands" },
}

export function NamedEntityModal({
  kind,
  entity,
  onClose,
  onSaved,
}: {
  kind: NamedKind
  entity: NamedEntityDto | null
  onClose: () => void
  onSaved?: (e: NamedEntityDto) => void
}) {
  const save = useSaveNamed(kind)
  const isCategory = kind === "categories"
  const { form, formError, submitWith } = useApiForm(categorySchema, {
    name: entity?.name ?? "",
    isActive: entity?.isActive ?? true,
    gstRate: (entity?.gstRate ?? "") as (typeof GST_RATES)[number],
  })
  const label = LABELS[kind].one

  const onSubmit = submitWith(async ({ gstRate, ...values }) => {
    const saved = await save.mutateAsync({ id: entity?.id, input: isCategory ? { ...values, gstRate } : values })
    toast.success(entity ? `Saved ${saved.name}` : `Added ${saved.name}`)
    onSaved?.(saved)
    onClose()
  })

  return (
    <Modal
      title={entity ? `Edit ${label}` : `New ${label}`}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={`${kind}-form`} loading={form.formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id={`${kind}-form`} onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Name" htmlFor={`${kind}-name`} required error={form.formState.errors.name?.message}>
          <Input id={`${kind}-name`} autoFocus {...form.register("name")} />
        </Field>
        {isCategory && (
          <Field
            label="GST rate"
            htmlFor="categories-gst"
            error={form.formState.errors.gstRate?.message}
            hint="Products in this category use it unless they have their own rate. Changing it updates them."
          >
            <Select id="categories-gst" {...form.register("gstRate")}>
              <option value="">No category rate</option>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  )
}

export default function NamedEntityPanel({ kind }: { kind: NamedKind }) {
  const can = useCan()
  const manage = can("products.manage")
  const [showInactive, setShowInactive] = useState(false)
  const { data, isLoading } = useNamedList(kind, showInactive)
  const save = useSaveNamed(kind)
  const [editing, setEditing] = useState<NamedEntityDto | null | undefined>(undefined)
  const [toggling, setToggling] = useState<NamedEntityDto | null>(null)
  const label = LABELS[kind]

  const toggle = async () => {
    if (!toggling) return
    try {
      await save.mutateAsync({ id: toggling.id, input: { isActive: !toggling.isActive } })
      setToggling(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: ColumnDef<NamedEntityDto>[] = [
    { header: "Name", accessorKey: "name", meta: { cellClassName: "font-medium" } },
    ...(kind === "categories"
      ? [
          {
            id: "gst",
            header: "GST",
            meta: { align: "right" as const, cellClassName: "tabular" },
            cell: ({ row }: { row: { original: NamedEntityDto } }) => (row.original.gstRate ? `${row.original.gstRate}%` : "—"),
          },
        ]
      : []),
    { header: "Products", accessorKey: "productCount", meta: { align: "right", cellClassName: "tabular" } },
    {
      header: "Status",
      cell: ({ row }) => <Badge tone={row.original.isActive ? "green" : "gray"}>{row.original.isActive ? "Active" : "Inactive"}</Badge>,
    },
    ...(manage
      ? [
          {
            id: "actions",
            meta: { align: "right" as const },
            cell: ({ row }: { row: { original: NamedEntityDto } }) => (
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
      : []),
  ]

  return (
    <>
      <ListToolbar
        actions={
          manage && (
            <Button icon={<Plus size={16} />} onClick={() => setEditing(null)}>
              Add {label.one}
            </Button>
          )
        }
      >
        <Checkbox
          id={`${kind}-inactive`}
          label="Show inactive"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={500}
        loading={isLoading}
        onPageChange={() => undefined}
        getRowId={(r) => r.id}
        emptyTitle={`No ${label.many} yet`}
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">{r.name}</p>
              <p className="text-xs text-muted">
                {r.gstRate ? `GST ${r.gstRate}% · ` : ""}
                {r.productCount} products{r.isActive ? "" : " · inactive"}
              </p>
            </div>
            {manage && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                Edit
              </Button>
            )}
          </div>
        )}
      />
      {editing !== undefined && <NamedEntityModal kind={kind} entity={editing} onClose={() => setEditing(undefined)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling.name}?`}
          message={
            toggling.isActive
              ? `It won't be offered for new products. The ${toggling.productCount} existing products keep it.`
              : "It will be offered for products again."
          }
          confirmLabel={toggling.isActive ? "Deactivate" : "Reactivate"}
          tone={toggling.isActive ? "danger" : "primary"}
          loading={save.isPending}
          onConfirm={toggle}
          onCancel={() => setToggling(null)}
        />
      )}
    </>
  )
}
