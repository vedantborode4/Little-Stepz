"use client"

import { toast } from "sonner"
import { businessProfileSchema, INDIAN_STATES, type BusinessProfileDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import { formatDateTime } from "@/lib/format"
import { useApiForm } from "@/lib/use-api-form"
import { useBusinessProfile, useSaveBusinessProfile } from "./api"

function ProfileForm({ profile }: { profile: BusinessProfileDto | null }) {
  const save = useSaveBusinessProfile()
  const { form, formError, submitWith } = useApiForm(businessProfileSchema, {
    legalName: profile?.legalName ?? "",
    tradeName: profile?.tradeName ?? "",
    gstin: profile?.gstin ?? "",
    stateCode: (profile?.stateCode ?? "36") as never,
    addressLine: profile?.addressLine ?? "",
    city: profile?.city ?? "",
    pincode: profile?.pincode ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    receiptFooter: profile?.receiptFooter ?? "",
  })
  const { register, formState } = form
  const err = formState.errors

  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync(values)
    form.reset(form.getValues())
    toast.success("Business profile saved")
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card
        title="Business profile"
        action={profile && <span className="text-xs text-faint">Updated {formatDateTime(profile.updatedAt)}</span>}
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Legal name" htmlFor="legalName" required error={err.legalName?.message}>
              <Input id="legalName" {...register("legalName")} />
            </Field>
            <Field label="Trade name" htmlFor="tradeName" required error={err.tradeName?.message} hint="Printed on receipts.">
              <Input id="tradeName" {...register("tradeName")} />
            </Field>
            <Field label="GSTIN" htmlFor="gstin" error={err.gstin?.message} hint="15 characters. Leave blank if not applicable.">
              <Input id="gstin" className="uppercase" maxLength={15} {...register("gstin")} />
            </Field>
            <Field
              label="State (GST)"
              htmlFor="stateCode"
              required
              error={err.stateCode?.message}
              hint="Decides CGST+SGST vs IGST on sales."
            >
              <Select id="stateCode" {...register("stateCode")}>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Address" htmlFor="addressLine" required error={err.addressLine?.message} className="md:col-span-2">
              <Input id="addressLine" {...register("addressLine")} />
            </Field>
            <Field label="City" htmlFor="city" required error={err.city?.message}>
              <Input id="city" {...register("city")} />
            </Field>
            <Field label="PIN code" htmlFor="pincode" required error={err.pincode?.message}>
              <Input id="pincode" inputMode="numeric" maxLength={6} {...register("pincode")} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={err.phone?.message}>
              <Input id="phone" inputMode="tel" {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="email" error={err.email?.message}>
              <Input id="email" type="email" {...register("email")} />
            </Field>
            <Field label="Receipt footer" htmlFor="receiptFooter" error={err.receiptFooter?.message} className="md:col-span-2">
              <Textarea id="receiptFooter" rows={2} {...register("receiptFooter")} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => form.reset()} disabled={!formState.isDirty || formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
              Save changes
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}

export default function BusinessProfileForm() {
  const { data, isLoading } = useBusinessProfile()
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  return <ProfileForm profile={data ?? null} />
}
