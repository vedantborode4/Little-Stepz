"use client"

import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  createCustomerSchema,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  DUPLICATE_REASON_LABELS,
  formatMobile,
  INDIAN_STATES,
  type CustomerContactDto,
  type CustomerDetailDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { useApiForm } from "@/lib/use-api-form"
import { useDebounced } from "@/lib/use-debounced"
import { useDuplicateCheck, useSaveCustomer } from "./api"

interface Props {
  /** Editing needs the revealed contact, since the profile only holds masked values. */
  customer?: { detail: CustomerDetailDto; contact: CustomerContactDto }
  /** Prefills a new customer, e.g. the number typed into the POS search. */
  initial?: { name?: string; mobile?: string }
  onClose: () => void
  onSaved?: (customer: CustomerDetailDto) => void
}

function DuplicateWarnings({ name, mobile, pincode, excludeId }: { name: string; mobile: string; pincode: string; excludeId?: string }) {
  const params = useDebounced({ name: name.trim(), mobile: mobile.trim(), pincode: pincode.trim(), excludeId })
  const enabled = params.name.length >= 3 || params.mobile.replace(/\D/g, "").length >= 10
  const { data } = useDuplicateCheck(params, enabled)
  if (!enabled || !data?.length) return null
  return (
    <div className="sm:col-span-2 rounded-xl border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-500/10 px-3 py-2.5 text-sm">
      <p className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-300">
        <AlertTriangle size={15} /> This may be an existing customer
      </p>
      <ul className="mt-1.5 space-y-1">
        {data.map((m) => (
          <li key={m.id} className="text-xs text-muted">
            <Link href={`/customers/${m.id}`} target="_blank" className="font-medium text-primary hover:underline">
              {m.name} ({m.code})
            </Link>{" "}
            · {[m.mobile, m.city, m.pincode].filter(Boolean).join(" · ")} — {DUPLICATE_REASON_LABELS[m.reason]}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CustomerForm({ customer, initial, onClose, onSaved }: Props) {
  const save = useSaveCustomer()
  const c = customer?.detail
  const { form, formError, submitWith } = useApiForm(createCustomerSchema, {
    name: c?.name ?? initial?.name ?? "",
    mobile: customer?.contact.mobile ? formatMobile(customer.contact.mobile) : (initial?.mobile ?? ""),
    whatsapp: customer?.contact.whatsapp ? formatMobile(customer.contact.whatsapp) : "",
    email: customer?.contact.email ?? "",
    type: c?.type ?? "RETAIL",
    creditDays: c?.creditDays?.toString() ?? "",
    creditLimit: c?.creditLimit ?? "",
    addressLine: c?.addressLine ?? "",
    city: c?.city ?? "",
    stateCode: (c?.stateCode ?? "") as "",
    pincode: c?.pincode ?? "",
    notes: c?.notes ?? "",
    isActive: c?.isActive ?? true,
  })
  const { register, formState, watch } = form
  const e = formState.errors

  const onSubmit = submitWith(async (values) => {
    const saved = await save.mutateAsync({ id: c?.id, input: values })
    toast.success(c ? "Customer updated" : `Customer ${saved.code} added`)
    onSaved?.(saved)
    onClose()
  })

  return (
    <Modal
      title={c ? `Edit ${c.name}` : "New customer"}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Field label="Name" htmlFor="c-name" required error={e.name?.message} className="sm:col-span-2">
          <Input id="c-name" autoFocus {...register("name")} />
        </Field>
        <Field label="Mobile" htmlFor="c-mobile" error={e.mobile?.message} hint="10-digit Indian number, or +country code">
          <Input id="c-mobile" type="tel" inputMode="tel" {...register("mobile")} />
        </Field>
        <Field label="WhatsApp (if different)" htmlFor="c-whatsapp" error={e.whatsapp?.message}>
          <Input id="c-whatsapp" type="tel" inputMode="tel" {...register("whatsapp")} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={e.email?.message}>
          <Input id="c-email" type="email" {...register("email")} />
        </Field>
        <Field label="Customer type" htmlFor="c-type">
          <Select id="c-type" {...register("type")}>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {CUSTOMER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Credit days" htmlFor="c-days" error={e.creditDays?.message} hint="Blank = pays at purchase">
          <Input id="c-days" inputMode="numeric" {...register("creditDays")} />
        </Field>
        <Field label="Credit limit (₹)" htmlFor="c-limit" error={e.creditLimit?.message} hint="Blank = no limit set">
          <Input id="c-limit" inputMode="decimal" {...register("creditLimit")} />
        </Field>
        <Field label="Address" htmlFor="c-address" error={e.addressLine?.message} className="sm:col-span-2">
          <Textarea id="c-address" rows={2} {...register("addressLine")} />
        </Field>
        <Field label="City" htmlFor="c-city" error={e.city?.message}>
          <Input id="c-city" {...register("city")} />
        </Field>
        <Field label="PIN code" htmlFor="c-pin" error={e.pincode?.message}>
          <Input id="c-pin" inputMode="numeric" maxLength={6} {...register("pincode")} />
        </Field>
        <Field label="State" htmlFor="c-state" className="sm:col-span-2">
          <Select id="c-state" {...register("stateCode")}>
            <option value="">—</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="c-notes" error={e.notes?.message} className="sm:col-span-2">
          <Textarea id="c-notes" rows={2} {...register("notes")} />
        </Field>
        <DuplicateWarnings name={watch("name") ?? ""} mobile={watch("mobile") ?? ""} pincode={watch("pincode") ?? ""} excludeId={c?.id} />
      </form>
    </Modal>
  )
}
