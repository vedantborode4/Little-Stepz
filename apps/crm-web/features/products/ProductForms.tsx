"use client"

import clsx from "clsx"
import { Plus, Trash2, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { createProductSchema, GST_RATES, MAX_OPTIONS, updateProductSchema, type ProductDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ChipsInput from "@/components/ui/ChipsInput"
import { Card } from "@/components/ui/Display"
import { Checkbox, controlClass, FormError, Input } from "@/components/ui/Form"
import { useApiForm } from "@/lib/use-api-form"
import { useCreateProduct, useUpdateProduct } from "./api"
import ProductBasicsFields, { type ProductBasicsValues } from "./ProductBasicsFields"
import { comboKey, emptyVariant, suggestSku, syncVariants, type OptionDraft, type VariantDraft } from "./variant-matrix"

type CreateForm = ReturnType<typeof useApiForm<typeof createProductSchema>>["form"]

const cellInput = clsx(controlClass, "py-2 px-2.5 text-sm min-w-[6.5rem]")

function basicsDefaults(p?: ProductDetailDto) {
  return {
    name: p ? `${p.name} (copy)` : "",
    categoryId: p?.category.id ?? "",
    brandId: p?.brand?.id ?? "",
    supplierId: p?.supplier?.id ?? "",
    scale: p?.scale ?? "",
    status: p?.status === "ARCHIVED" ? "ACTIVE" : (p?.status ?? "ACTIVE"),
    imageUrl: p?.imageUrl ?? "",
    description: p?.description ?? "",
    notes: p?.notes ?? "",
    hsnCode: p?.hsnCode ?? "",
    // Empty until chosen; the schema rejects "" with "Choose a GST rate".
    gstRate: (p?.gstRate ?? "") as (typeof GST_RATES)[number],
    websiteProductId: "",
  } as const
}

/** Duplicating keeps options and prices, but SKUs and website ids must be new. */
function variantDefaults(p?: ProductDetailDto): { options: OptionDraft[]; variants: VariantDraft[] } {
  if (!p) return { options: [], variants: [emptyVariant()] }
  const valueById = new Map(p.options.flatMap((o) => o.values.map((v) => [v.id, v.value])))
  return {
    options: p.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.value) })),
    variants: p.variants
      .filter((v) => v.status === "ACTIVE")
      .map((v) => ({
        sku: `${v.sku}-COPY`.slice(0, 40),
        optionValues: p.options.map((o) => valueById.get(v.optionValueIds.find((id) => o.values.some((ov) => ov.id === id)) ?? "") ?? ""),
        regularPrice: v.regularPrice,
        offerPrice: v.offerPrice ?? "",
        wholesalePrice: v.wholesalePrice ?? "",
        reorderLevel: v.reorderLevel,
      })),
  }
}

function FillAllRow({ form }: { form: CreateForm }) {
  const [fill, setFill] = useState({ prefix: "", regularPrice: "", offerPrice: "", wholesalePrice: "", reorderLevel: "" })
  const apply = () => {
    const rows = form.getValues("variants") as VariantDraft[]
    form.setValue(
      "variants",
      rows.map((row) => ({
        ...row,
        sku: fill.prefix ? suggestSku(fill.prefix, row.optionValues) : row.sku,
        regularPrice: fill.regularPrice || row.regularPrice,
        offerPrice: fill.offerPrice || row.offerPrice,
        wholesalePrice: fill.wholesalePrice || row.wholesalePrice,
        reorderLevel: fill.reorderLevel ? Number(fill.reorderLevel) : row.reorderLevel,
      })),
      { shouldDirty: true },
    )
  }
  const input = (key: keyof typeof fill, placeholder: string, mode: "text" | "decimal" | "numeric" = "decimal") => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      inputMode={mode}
      value={fill[key]}
      onChange={(e) => setFill({ ...fill, [key]: e.target.value })}
      className={cellInput}
    />
  )
  return (
    <div className="rounded-xl bg-surface-2 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted">Fill every row at once</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {input("prefix", "SKU prefix e.g. YG64", "text")}
        {input("regularPrice", "Regular ₹")}
        {input("offerPrice", "Offer ₹")}
        {input("wholesalePrice", "Wholesale ₹")}
        {input("reorderLevel", "Reorder at", "numeric")}
        <Button variant="secondary" icon={<Wand2 size={15} />} onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  )
}

function VariantRows({ form, withOptions }: { form: CreateForm; withOptions: boolean }) {
  const variants = (useWatch({ control: form.control, name: "variants" }) ?? []) as VariantDraft[]
  const errors = form.formState.errors.variants
  const rowError = (i: number, key: keyof VariantDraft) => (Array.isArray(errors) ? errors[i]?.[key]?.message : undefined)

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr>
            {withOptions && <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Variant</th>}
            {["SKU", "Regular ₹", "Offer ₹", "Wholesale ₹", "Reorder at"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => (
            <tr key={comboKey(v.optionValues) || "default"} className="border-t border-border align-top">
              {withOptions && <td className="px-3 py-2 font-medium whitespace-nowrap pt-4">{v.optionValues.join(" / ")}</td>}
              {(["sku", "regularPrice", "offerPrice", "wholesalePrice", "reorderLevel"] as const).map((key) => (
                <td key={key} className="px-2 py-2">
                  <input
                    aria-label={`${key} for ${v.optionValues.join(" / ") || "product"}`}
                    aria-invalid={!!rowError(i, key)}
                    title={rowError(i, key)}
                    inputMode={key === "sku" ? "text" : key === "reorderLevel" ? "numeric" : "decimal"}
                    className={clsx(cellInput, key === "sku" && "font-mono uppercase min-w-[9rem]")}
                    {...form.register(`variants.${i}.${key}`)}
                  />
                  {rowError(i, key) && <p className="text-[11px] text-red-500 mt-1 max-w-[12rem]">{rowError(i, key)}</p>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OptionsEditor({ form }: { form: CreateForm }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" })
  const options = (useWatch({ control: form.control, name: "options" }) ?? []) as OptionDraft[]

  // Regenerate rows whenever the set of combinations changes; typed values survive for combinations that remain.
  const signature = JSON.stringify(options.map((o) => o.values))
  useEffect(() => {
    const current = form.getValues("variants") as VariantDraft[]
    const next = syncVariants(options, current)
    const changed =
      next.length !== current.length || next.some((row, i) => comboKey(row.optionValues) !== comboKey(current[i]?.optionValues ?? []))
    if (changed) form.setValue("variants", next.length ? next : [emptyVariant()], { shouldDirty: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const optionErrors = form.formState.errors.options
  return (
    <div className="space-y-3">
      {fields.map((field, i) => (
        <div key={field.id} className="grid grid-cols-1 md:grid-cols-[12rem_1fr_auto] gap-2 items-start">
          <Input aria-label="Option name" placeholder="Option e.g. Colour" {...form.register(`options.${i}.name`)} />
          <Controller
            control={form.control}
            name={`options.${i}.values`}
            render={({ field: f }) => (
              <ChipsInput
                value={(f.value as string[]) ?? []}
                onChange={f.onChange}
                placeholder="Type a value and press Enter (Red, Blue…)"
                invalid={Array.isArray(optionErrors) && !!optionErrors[i]?.values}
              />
            )}
          />
          <Button variant="ghost" icon={<Trash2 size={15} />} aria-label="Remove option" onClick={() => remove(i)} />
        </div>
      ))}
      {fields.length < MAX_OPTIONS && (
        <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => append({ name: "", values: [] })}>
          Add option
        </Button>
      )}
    </div>
  )
}

export function ProductCreateForm({ source }: { source?: ProductDetailDto }) {
  const router = useRouter()
  const create = useCreateProduct()
  const defaults = variantDefaults(source)
  const { form, formError, submitWith } = useApiForm(createProductSchema, { ...basicsDefaults(source), ...defaults })
  const [hasVariants, setHasVariants] = useState(defaults.options.length > 0)
  const variantErrors = form.formState.errors.variants

  const toggleVariants = (on: boolean) => {
    setHasVariants(on)
    form.setValue("options", on ? [{ name: "Colour", values: [] }] : [])
    form.setValue("variants", [emptyVariant()])
  }

  const onSubmit = submitWith(async (values) => {
    const product = await create.mutateAsync(values)
    toast.success(`${product.code} created with ${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`)
    router.push(`/products/${product.id}`)
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:space-y-5">
      <FormError message={formError} />
      <ProductBasicsFields form={form as unknown as UseFormReturn<ProductBasicsValues>} />

      <Card title="Variants, SKUs & prices">
        <div className="space-y-4">
          <Checkbox
            id="hasVariants"
            label="This product comes in several colours, models or styles"
            description="Each combination gets its own SKU, price and stock. Options can't be added after the product is saved, but new values can."
            checked={hasVariants}
            onChange={(e) => toggleVariants(e.target.checked)}
          />
          {hasVariants && <OptionsEditor form={form} />}
          {hasVariants && <FillAllRow form={form} />}
          {variantErrors && !Array.isArray(variantErrors) && <FormError message={variantErrors.message ?? variantErrors.root?.message} />}
          <VariantRows form={form} withOptions={hasVariants} />
          <p className="text-xs text-faint">
            Prices include GST. Offer and wholesale prices are optional and can&apos;t exceed the regular price.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-20 lg:bottom-4 z-10">
        <div className="flex gap-2 bg-surface/90 backdrop-blur border border-border rounded-2xl p-2 shadow-card">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Create product
          </Button>
        </div>
      </div>
    </form>
  )
}

export function ProductEditForm({ product }: { product: ProductDetailDto }) {
  const router = useRouter()
  const update = useUpdateProduct(product.id)
  const { form, formError, submitWith } = useApiForm(updateProductSchema, {
    ...basicsDefaults(product),
    name: product.name,
    status: product.status,
    websiteProductId: product.websiteProductId ?? "",
  })

  const onSubmit = submitWith(async (values) => {
    await update.mutateAsync(values)
    toast.success("Product updated")
    router.push(`/products/${product.id}`)
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:space-y-5">
      <FormError message={formError} />
      <ProductBasicsFields form={form as unknown as UseFormReturn<ProductBasicsValues>} />
      <div className="flex justify-end gap-2 sticky bottom-20 lg:bottom-4 z-10">
        <div className="flex gap-2 bg-surface/90 backdrop-blur border border-border rounded-2xl p-2 shadow-card">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  )
}
