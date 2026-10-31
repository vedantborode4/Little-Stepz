"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Wallet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { createReceivingAccountSchema, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type ReceivingAccountDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { useApiForm } from "@/lib/use-api-form"
import { useReceivingAccounts, useSaveReceivingAccount } from "./api"

function AccountFormModal({ account, onClose }: { account: ReceivingAccountDto | null; onClose: () => void }) {
  const save = useSaveReceivingAccount()
  const { form, formError, submitWith } = useApiForm(createReceivingAccountSchema, {
    name: account?.name ?? "",
    method: account?.method ?? "UPI",
    isPersonal: account?.isPersonal ?? false,
    feePercent: account?.feePercent ?? "0",
    details: account?.details ?? "",
    isActive: account?.isActive ?? true,
  })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ id: account?.id, input: values })
    toast.success(account ? "Account updated" : "Account added")
    onClose()
  })

  return (
    <Modal
      title={account ? `Edit ${account.name}` : "Add receiving account"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="account-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Name" htmlFor="name" required error={formState.errors.name?.message} hint="e.g. PhonePe — Business, HDFC Current">
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Method" htmlFor="method" required>
          <Select id="method" {...register("method")}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Processing fee %"
          htmlFor="feePercent"
          error={formState.errors.feePercent?.message}
          hint="Default fee the provider deducts (used for contribution profit). 0 for cash/UPI."
        >
          <Input id="feePercent" inputMode="decimal" {...register("feePercent")} />
        </Field>
        <Field
          label="Details"
          htmlFor="details"
          error={formState.errors.details?.message}
          hint="UPI ID, bank name or last 4 digits — no full account numbers."
        >
          <Input id="details" {...register("details")} />
        </Field>
        <Checkbox
          id="isPersonal"
          label="Personal account"
          description="Business money received here is still counted, but reported separately."
          {...register("isPersonal")}
        />
      </form>
    </Modal>
  )
}

export default function ReceivingAccountsPanel() {
  const [showInactive, setShowInactive] = useState(false)
  const { data, isLoading } = useReceivingAccounts(showInactive)
  const save = useSaveReceivingAccount()
  const [editing, setEditing] = useState<ReceivingAccountDto | null | undefined>(undefined)
  const [toggling, setToggling] = useState<ReceivingAccountDto | null>(null)

  const toggleActive = async () => {
    if (!toggling) return
    try {
      await save.mutateAsync({ id: toggling.id, input: { isActive: !toggling.isActive } })
      toast.success(toggling.isActive ? "Account deactivated" : "Account reactivated")
      setToggling(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: ColumnDef<ReceivingAccountDto>[] = [
    { header: "Name", accessorKey: "name", meta: { cellClassName: "font-medium" } },
    { header: "Method", cell: ({ row }) => PAYMENT_METHOD_LABELS[row.original.method] },
    {
      header: "Ownership",
      cell: ({ row }) => (
        <Badge tone={row.original.isPersonal ? "purple" : "blue"}>{row.original.isPersonal ? "Personal" : "Business"}</Badge>
      ),
    },
    { header: "Fee %", accessorKey: "feePercent", meta: { align: "right", cellClassName: "tabular" } },
    { header: "Details", cell: ({ row }) => row.original.details ?? <span className="text-faint">—</span> },
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
            Add account
          </Button>
        }
      >
        <Checkbox id="acc-inactive" label="Show inactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        loading={isLoading}
        onPageChange={() => undefined}
        getRowId={(a) => a.id}
        emptyTitle="No receiving accounts yet"
        mobileCard={(a) => (
          <div className="flex items-start gap-3">
            <Wallet size={18} className="text-faint mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">{a.name}</p>
              <p className="text-xs text-muted">
                {PAYMENT_METHOD_LABELS[a.method]} · {a.isPersonal ? "Personal" : "Business"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(a)}>
              Edit
            </Button>
          </div>
        )}
      />
      {editing !== undefined && <AccountFormModal account={editing} onClose={() => setEditing(undefined)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? "Deactivate account?" : "Reactivate account?"}
          message={
            toggling.isActive
              ? `${toggling.name} won't be offered for new payments. Past payments into it stay in reports.`
              : `${toggling.name} will be offered for new payments again.`
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
