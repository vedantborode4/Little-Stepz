"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { createSalespersonSchema, type SalespersonDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { useApiForm } from "@/lib/use-api-form"
import { useSalespeople, useSaveSalesperson } from "./api"

function SalespersonModal({ person, onClose }: { person: SalespersonDto | null; onClose: () => void }) {
  const save = useSaveSalesperson()
  const { form, formError, submitWith } = useApiForm(createSalespersonSchema, {
    name: person?.name ?? "",
    commissionRate: person?.commissionRate ?? "",
    isActive: person?.isActive ?? true,
  })
  const { register, formState } = form
  const e = formState.errors
  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ id: person?.id, input: values })
    toast.success(person ? "Salesperson updated" : "Salesperson added")
    onClose()
  })
  return (
    <Modal
      title={person ? `Edit ${person.name}` : "Add salesperson"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="salesperson-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="salesperson-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        {person ? (
          <p className="text-sm text-muted">
            Staff ID <span className="font-mono font-semibold text-text">{person.staffCode}</span>
          </p>
        ) : (
          <p className="text-sm text-muted">A staff ID (S01, S02…) is given automatically when you save.</p>
        )}
        <Field label="Name" htmlFor="sp-name" required error={e.name?.message}>
          <Input id="sp-name" {...register("name")} />
        </Field>
        <Field
          label="Commission % of gross profit"
          htmlFor="sp-rate"
          required
          error={e.commissionRate?.message}
          hint={person ? "A new % applies to sales from now on" : "Gross profit = sale value excluding GST minus the cost of the goods"}
        >
          <Input id="sp-rate" inputMode="decimal" placeholder="2.5" {...register("commissionRate")} />
        </Field>
        <Checkbox id="sp-active" label="Active (can be picked at checkout)" {...register("isActive")} />
      </form>
    </Modal>
  )
}

export default function SalespeoplePanel() {
  const { data, isLoading } = useSalespeople(true)
  const [editing, setEditing] = useState<SalespersonDto | null | undefined>(undefined)

  const columns: ColumnDef<SalespersonDto>[] = [
    { id: "code", header: "Staff ID", meta: { cellClassName: "font-mono text-xs" }, cell: ({ row }) => row.original.staffCode },
    { id: "name", header: "Name", meta: { cellClassName: "font-medium" }, cell: ({ row }) => row.original.name },
    {
      id: "rate",
      header: "Commission",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => `${row.original.commissionRate}%`,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge tone={row.original.isActive ? "green" : "gray"}>{row.original.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(row.original)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <ListToolbar
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add salesperson
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Staff picked at checkout earn their % of each sale&apos;s gross profit (sale value excluding GST minus cost). Staff IDs are given
          automatically. A rate change applies to new sales only.
        </p>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        loading={isLoading}
        onPageChange={() => {}}
        getRowId={(p) => p.id}
        emptyTitle="No salespeople yet"
        emptyHint="Add your sales staff with their commission %."
        mobileCard={(p) => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {p.name} <span className="font-mono text-xs text-muted">{p.staffCode}</span>
              </p>
              <p className="text-xs text-muted">
                {p.commissionRate}% · {p.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
              Edit
            </Button>
          </div>
        )}
      />
      {editing !== undefined && <SalespersonModal person={editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
