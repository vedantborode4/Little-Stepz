"use client"

import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import {
  addVariantSchema,
  PRICE_FIELD_LABELS,
  priceTiersSchema,
  updateVariantSchema,
  type ProductDetailDto,
  type VariantDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Badge, EmptyState, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useApiForm } from "@/lib/use-api-form"
import { useAddVariant, usePriceHistory, useSetPriceTiers, useUpdateVariant } from "./api"

/** Price fields shared by the add and edit variant forms. */
interface PriceValues {
  regularPrice?: string
  offerPrice?: string | null
  wholesalePrice?: string | null
  reorderLevel?: number | string
}

function PriceFields({ form }: { form: UseFormReturn<PriceValues> }) {
  const { register } = form
  const errors = form.formState.errors
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Regular price ₹" htmlFor="regularPrice" required error={errors.regularPrice?.message}>
        <Input id="regularPrice" inputMode="decimal" {...register("regularPrice")} />
      </Field>
      <Field label="Offer price ₹" htmlFor="offerPrice" error={errors.offerPrice?.message} hint="Leave blank for no offer.">
        <Input id="offerPrice" inputMode="decimal" {...register("offerPrice")} />
      </Field>
      <Field label="Wholesale price ₹" htmlFor="wholesalePrice" error={errors.wholesalePrice?.message}>
        <Input id="wholesalePrice" inputMode="decimal" {...register("wholesalePrice")} />
      </Field>
      <Field
        label="Reorder level"
        htmlFor="reorderLevel"
        error={errors.reorderLevel?.message}
        hint="Alert when available stock falls to this."
      >
        <Input id="reorderLevel" inputMode="numeric" {...register("reorderLevel")} />
      </Field>
    </div>
  )
}

function ModalFooter({
  formId,
  onClose,
  submitting,
  label = "Save",
}: {
  formId: string
  onClose: () => void
  submitting: boolean
  label?: string
}) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" form={formId} loading={submitting}>
        {label}
      </Button>
    </>
  )
}

export function EditVariantModal({ variant, onClose }: { variant: VariantDto; onClose: () => void }) {
  const update = useUpdateVariant()
  const { form, formError, submitWith } = useApiForm(updateVariantSchema, {
    sku: variant.sku,
    regularPrice: variant.regularPrice,
    offerPrice: variant.offerPrice ?? "",
    wholesalePrice: variant.wholesalePrice ?? "",
    reorderLevel: variant.reorderLevel,
    reason: "",
  })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    await update.mutateAsync({ id: variant.id, input: values })
    toast.success(`${values.sku ?? variant.sku} saved`)
    onClose()
  })

  return (
    <Modal
      title={`Edit ${variant.name}`}
      onClose={onClose}
      footer={<ModalFooter formId="variant-form" onClose={onClose} submitting={formState.isSubmitting} />}
    >
      <form id="variant-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="SKU" htmlFor="sku" required error={formState.errors.sku?.message}>
          <Input id="sku" className="font-mono uppercase" {...register("sku")} />
        </Field>
        <PriceFields form={form as unknown as UseFormReturn<PriceValues>} />
        <Field label="Reason for price change" htmlFor="reason" hint="Saved in the price history, e.g. 'Diwali offer'.">
          <Input id="reason" {...register("reason")} />
        </Field>
        <p className="text-xs text-faint">
          Completed sales keep the price they were sold at. Changing a price here only affects future sales.
        </p>
      </form>
    </Modal>
  )
}

export function AddVariantModal({ product, onClose }: { product: ProductDetailDto; onClose: () => void }) {
  const add = useAddVariant(product.id)
  const { form, formError, submitWith } = useApiForm(addVariantSchema, {
    sku: "",
    optionValues: product.options.map(() => ""),
    regularPrice: product.variants[0]?.regularPrice ?? "",
    offerPrice: product.variants[0]?.offerPrice ?? "",
    wholesalePrice: product.variants[0]?.wholesalePrice ?? "",
    reorderLevel: product.variants[0]?.reorderLevel ?? 0,
  })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    await add.mutateAsync(values)
    toast.success(`${values.sku} added`)
    onClose()
  })

  return (
    <Modal
      title="Add variant"
      onClose={onClose}
      footer={<ModalFooter formId="add-variant-form" onClose={onClose} submitting={formState.isSubmitting} label="Add variant" />}
    >
      <form id="add-variant-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        {product.options.map((option, i) => (
          <Field key={option.id} label={option.name} htmlFor={`opt-${i}`} required hint="Pick an existing value or type a new one.">
            <Input id={`opt-${i}`} list={`opt-values-${i}`} {...register(`optionValues.${i}`)} />
            <datalist id={`opt-values-${i}`}>
              {option.values.map((v) => (
                <option key={v.id} value={v.value} />
              ))}
            </datalist>
          </Field>
        ))}
        <Field label="SKU" htmlFor="sku" required error={formState.errors.sku?.message}>
          <Input id="sku" className="font-mono uppercase" {...register("sku")} />
        </Field>
        <PriceFields form={form as unknown as UseFormReturn<PriceValues>} />
      </form>
    </Modal>
  )
}

export function PriceTiersModal({ variant, onClose }: { variant: VariantDto; onClose: () => void }) {
  const save = useSetPriceTiers()
  const { form, formError, submitWith } = useApiForm(priceTiersSchema, {
    tiers: variant.priceTiers.map((t) => ({ minQty: t.minQty, price: t.price })),
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" })
  const tierErrors = form.formState.errors.tiers

  const onSubmit = submitWith(async (values) => {
    await save.mutateAsync({ id: variant.id, input: values })
    toast.success("Quantity pricing saved")
    onClose()
  })

  return (
    <Modal
      title={`Quantity pricing — ${variant.name}`}
      onClose={onClose}
      footer={<ModalFooter formId="tiers-form" onClose={onClose} submitting={form.formState.isSubmitting} />}
    >
      <form id="tiers-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <p className="text-sm text-muted">
          Wholesale buyers pay the tier price per unit when they buy at least that many. Regular price:{" "}
          <strong>{formatMoney(variant.regularPrice)}</strong>.
        </p>
        {fields.length === 0 && <p className="text-sm text-faint">No tiers yet.</p>}
        {fields.map((field, i) => {
          const rowErr = Array.isArray(tierErrors) ? tierErrors[i] : undefined
          return (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
              <Field label="From quantity" htmlFor={`tier-qty-${i}`} error={rowErr?.minQty?.message}>
                <Input id={`tier-qty-${i}`} inputMode="numeric" {...form.register(`tiers.${i}.minQty`)} />
              </Field>
              <Field label="Price per unit ₹" htmlFor={`tier-price-${i}`} error={rowErr?.price?.message}>
                <Input id={`tier-price-${i}`} inputMode="decimal" {...form.register(`tiers.${i}.price`)} />
              </Field>
              <Button variant="ghost" className="mt-7" icon={<Trash2 size={15} />} aria-label="Remove tier" onClick={() => remove(i)} />
            </div>
          )
        })}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => append({ minQty: (fields.length + 1) * 10, price: "" })}
        >
          Add tier
        </Button>
      </form>
    </Modal>
  )
}

export function PriceHistoryModal({ variant, onClose }: { variant: VariantDto; onClose: () => void }) {
  const { data, isLoading } = usePriceHistory(variant.id)
  return (
    <Modal title={`Price history — ${variant.sku}`} onClose={onClose} width="max-w-2xl">
      {isLoading && <Skeleton className="h-40 rounded-xl" />}
      {data?.length === 0 && <EmptyState title="No price changes recorded" />}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border">
          {data.map((c) => (
            <li key={c.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Badge tone={c.field === "REGULAR" ? "blue" : c.field === "OFFER" ? "red" : "purple"}>{PRICE_FIELD_LABELS[c.field]}</Badge>
              <span className="text-sm tabular">
                <span className="text-muted line-through decoration-faint">{c.oldPrice ? formatMoney(c.oldPrice) : "none"}</span>
                {" → "}
                <strong>{c.newPrice ? formatMoney(c.newPrice) : "removed"}</strong>
              </span>
              <span className="text-xs text-muted flex-1">{c.reason ?? (c.batchId ? "Bulk edit" : "")}</span>
              <span className="text-xs text-faint">
                {c.changedByName ?? "System"} · {formatDateTime(c.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
