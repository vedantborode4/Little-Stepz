"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { MapPin, Pencil, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { createLocationSchema, LOCATION_TYPE_LABELS, LOCATION_TYPES, type LocationDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { useApiForm } from "@/lib/use-api-form"
import { useLocations, useSaveLocation } from "./api"

function LocationFormModal({ location, onClose }: { location: LocationDto | null; onClose: () => void }) {
  const save = useSaveLocation()
  const { form, formError, submitWith } = useApiForm(createLocationSchema, {
    code: location?.code ?? "",
    name: location?.name ?? "",
    type: location?.type ?? "STORE",
    address: location?.address ?? "",
    isActive: location?.isActive ?? true,
  })
  const { register, formState } = form

  const onSubmit = submitWith(async ({ code, ...rest }) => {
    await save.mutateAsync(location ? { id: location.id, input: rest } : { input: { code, ...rest } })
    toast.success(location ? "Location updated" : "Location added")
    onClose()
  })

  return (
    <Modal
      title={location ? `Edit ${location.name}` : "Add location"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="location-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="location-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field
          label="Code"
          htmlFor="code"
          required
          error={formState.errors.code?.message}
          hint={location ? "Codes can't change once stock documents use them." : "Short unique code, e.g. STORE or GODOWN."}
        >
          <Input id="code" className="uppercase" disabled={!!location} {...register("code")} />
        </Field>
        <Field label="Name" htmlFor="name" required error={formState.errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Type" htmlFor="type" required>
          <Select id="type" {...register("type")}>
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Address" htmlFor="address" error={formState.errors.address?.message}>
          <Input id="address" {...register("address")} />
        </Field>
      </form>
    </Modal>
  )
}

export default function LocationsPanel() {
  const [showInactive, setShowInactive] = useState(false)
  const { data, isLoading } = useLocations(showInactive)
  const save = useSaveLocation()
  const [editing, setEditing] = useState<LocationDto | null | undefined>(undefined)
  const [toggling, setToggling] = useState<LocationDto | null>(null)

  const toggleActive = async () => {
    if (!toggling) return
    try {
      await save.mutateAsync({ id: toggling.id, input: { isActive: !toggling.isActive } })
      toast.success(toggling.isActive ? "Location deactivated" : "Location reactivated")
      setToggling(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: ColumnDef<LocationDto>[] = [
    { header: "Code", accessorKey: "code", meta: { cellClassName: "font-mono text-xs" } },
    { header: "Name", accessorKey: "name", meta: { cellClassName: "font-medium" } },
    { header: "Type", cell: ({ row }) => LOCATION_TYPE_LABELS[row.original.type] },
    { header: "Address", cell: ({ row }) => row.original.address ?? <span className="text-faint">—</span> },
    {
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
    <>
      <ListToolbar
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add location
          </Button>
        }
      >
        <Checkbox id="loc-inactive" label="Show inactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        loading={isLoading}
        onPageChange={() => undefined}
        getRowId={(l) => l.id}
        emptyTitle="No locations yet"
        mobileCard={(l) => (
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-faint mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">
                {l.name} <span className="font-mono text-xs text-faint">{l.code}</span>
              </p>
              <p className="text-xs text-muted">{LOCATION_TYPE_LABELS[l.type]}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(l)}>
              Edit
            </Button>
          </div>
        )}
      />
      {editing !== undefined && <LocationFormModal location={editing} onClose={() => setEditing(undefined)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? "Deactivate location?" : "Reactivate location?"}
          message={
            toggling.isActive
              ? `${toggling.name} will no longer be offered for new stock movements. Its history is kept.`
              : `${toggling.name} will be available for stock movements again.`
          }
          confirmLabel={toggling.isActive ? "Deactivate" : "Reactivate"}
          tone={toggling.isActive ? "danger" : "primary"}
          loading={save.isPending}
          onConfirm={toggleActive}
          onCancel={() => setToggling(null)}
        />
      )}
    </>
  )
}
