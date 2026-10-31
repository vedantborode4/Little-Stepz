"use client"

import { Plus } from "lucide-react"
import { forwardRef, useState } from "react"
import { toast } from "sonner"
import { createSupplierSchema, CURRENCIES } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { useApiForm } from "@/lib/use-api-form"
import { useCreateSupplier, useNamedList, useSuppliers, type NamedKind } from "./api"
import { NamedEntityModal } from "./NamedEntityPanel"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder: string
  /** Called with the new id after inline creation, so the form can select it. */
  onCreated: (id: string) => void
}

function SupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const create = useCreateSupplier()
  const { form, formError, submitWith } = useApiForm(createSupplierSchema, { name: "", currency: "INR", country: "" })
  const onSubmit = submitWith(async (values) => {
    const supplier = await create.mutateAsync(values)
    toast.success(`Added ${supplier.name}`)
    onSaved(supplier.id)
    onClose()
  })
  return (
    <Modal
      title="New supplier"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-quick-form" loading={form.formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="supplier-quick-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Name" htmlFor="sup-name" required error={form.formState.errors.name?.message}>
          <Input id="sup-name" autoFocus {...form.register("name")} />
        </Field>
        <Field label="Country" htmlFor="sup-country">
          <Input id="sup-country" {...form.register("country")} />
        </Field>
        <Field label="Invoice currency" htmlFor="sup-currency">
          <Select id="sup-currency" {...form.register("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">Contact details can be added later under Purchases → Suppliers.</p>
      </form>
    </Modal>
  )
}

/** A native select of categories, brands or suppliers with an inline "+ New" for when the right one doesn't exist yet. */
export const LookupSelect = forwardRef<HTMLSelectElement, SelectProps & { kind: NamedKind | "suppliers"; canCreate: boolean }>(
  function LookupSelect({ kind, canCreate, placeholder, onCreated, ...rest }, ref) {
    const [creating, setCreating] = useState(false)
    const isSupplier = kind === "suppliers"
    const named = useNamedList(isSupplier ? "categories" : kind, false, !isSupplier)
    const suppliers = useSuppliers(undefined, isSupplier)
    const options = isSupplier ? (suppliers.data?.items ?? []) : (named.data ?? [])

    return (
      <div className="flex gap-2">
        <Select ref={ref} {...rest}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        {canCreate && <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setCreating(true)} aria-label={`New ${kind}`} />}
        {creating && kind === "suppliers" && <SupplierModal onClose={() => setCreating(false)} onSaved={onCreated} />}
        {creating && kind !== "suppliers" && (
          <NamedEntityModal kind={kind} entity={null} onClose={() => setCreating(false)} onSaved={(e) => onCreated(e.id)} />
        )}
      </div>
    )
  },
)
