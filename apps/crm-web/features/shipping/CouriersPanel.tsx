"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { createCourierSchema, type CourierDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { useApiForm } from "@/lib/use-api-form"
import { useCouriers, useSaveCourier } from "./api"

function CourierModal({ courier, onClose }: { courier: CourierDto | null; onClose: () => void }) {
  const save = useSaveCourier()
  const { form, formError, submitWith } = useApiForm(createCourierSchema, {
    name: courier?.name ?? "",
    trackingUrlTemplate: courier?.trackingUrlTemplate ?? "",
    phone: courier?.phone ?? "",
    notes: courier?.notes ?? "",
    isActive: courier?.isActive ?? true,
  })
  const { register, formState } = form
  const e = formState.errors
  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ id: courier?.id, input: values })
    toast.success(courier ? "Courier updated" : "Courier added")
    onClose()
  })
  return (
    <Modal
      title={courier ? `Edit ${courier.name}` : "Add courier"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="courier-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="courier-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Name" htmlFor="co-name" required error={e.name?.message}>
          <Input id="co-name" {...register("name")} />
        </Field>
        <Field
          label="Tracking link"
          htmlFor="co-url"
          error={e.trackingUrlTemplate?.message}
          hint="Put {awb} where the tracking number goes, e.g. https://www.delhivery.com/track/package/{awb}"
        >
          <Input id="co-url" {...register("trackingUrlTemplate")} />
        </Field>
        <Field label="Phone" htmlFor="co-phone" error={e.phone?.message}>
          <Input id="co-phone" {...register("phone")} />
        </Field>
        <Field label="Notes" htmlFor="co-notes" error={e.notes?.message}>
          <Textarea id="co-notes" rows={2} {...register("notes")} />
        </Field>
        <Checkbox id="co-active" label="Active (offered when shipping)" {...register("isActive")} />
      </form>
    </Modal>
  )
}

export default function CouriersPanel() {
  const { data, isLoading } = useCouriers(true)
  const [editing, setEditing] = useState<CourierDto | null | undefined>(undefined)

  const columns: ColumnDef<CourierDto>[] = [
    { id: "name", header: "Courier", meta: { cellClassName: "font-medium" }, cell: ({ row }) => row.original.name },
    {
      id: "url",
      header: "Tracking link",
      meta: { cellClassName: "text-xs text-muted max-w-80 truncate" },
      cell: ({ row }) => row.original.trackingUrlTemplate ?? "—",
    },
    { id: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
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
            Add courier
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        loading={isLoading}
        onPageChange={() => {}}
        getRowId={(c) => c.id}
        emptyTitle="No couriers yet"
        emptyHint="Add Delhivery, DTDC, India Post and others with their tracking links."
        mobileCard={(c) => (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{c.name}</p>
            <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>
              Edit
            </Button>
          </div>
        )}
      />
      {editing !== undefined && <CourierModal courier={editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
