"use client"

import type { UseFormReturn } from "react-hook-form"
import { GST_RATES, PRODUCT_STATUS_LABELS, PRODUCT_STATUSES, type ProductStatus } from "@repo/crm-schema"
import { Card } from "@/components/ui/Display"
import { Field, Input, Select, Textarea } from "@/components/ui/Form"
import { useCan } from "@/store/auth.store"
import { useNamedList } from "./api"
import { LookupSelect } from "./LookupSelect"

/** The product-level fields shared by the create and edit forms. */
export interface ProductBasicsValues {
  name: string
  categoryId: string
  brandId?: string | null
  supplierId?: string | null
  scale?: string | null
  status?: ProductStatus
  description?: string | null
  notes?: string | null
  hsnCode?: string | null
  gstRate: string
  websiteProductId?: string | null
}

export default function ProductBasicsFields({ form }: { form: UseFormReturn<ProductBasicsValues> }) {
  const can = useCan()
  const manage = can("products.manage")
  const { register, setValue, formState, watch } = form
  const err = formState.errors
  const categories = useNamedList("categories")
  const categoryId = watch("categoryId")
  const categoryRate = categories.data?.find((c) => c.id === categoryId)?.gstRate
  const followLabel = categoryRate
    ? `Category rate (${categoryRate}%)`
    : categoryId
      ? "Category rate (the category has none yet)"
      : "Category rate"
  const select = (field: "categoryId" | "brandId" | "supplierId") => (id: string) =>
    setValue(field, id, { shouldDirty: true, shouldValidate: true })

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="Product details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product name" htmlFor="name" required error={err.name?.message} className="md:col-span-2">
            <Input id="name" placeholder="e.g. YEGAO 1:64 Die-cast Car" {...register("name")} />
          </Field>
          <Field label="Category" htmlFor="categoryId" required error={err.categoryId?.message}>
            <LookupSelect
              id="categoryId"
              kind="categories"
              canCreate={manage}
              placeholder="Choose a category"
              onCreated={select("categoryId")}
              {...register("categoryId")}
            />
          </Field>
          <Field label="Brand" htmlFor="brandId" error={err.brandId?.message}>
            <LookupSelect
              id="brandId"
              kind="brands"
              canCreate={manage}
              placeholder="No brand"
              onCreated={select("brandId")}
              {...register("brandId")}
            />
          </Field>
          <Field label="Scale" htmlFor="scale" error={err.scale?.message} hint="e.g. 1:64, 1:18, 1:12">
            <Input id="scale" {...register("scale")} />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" {...register("status")}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Main supplier" htmlFor="supplierId" error={err.supplierId?.message}>
            <LookupSelect
              id="supplierId"
              kind="suppliers"
              canCreate={manage}
              placeholder="Not set"
              onCreated={select("supplierId")}
              {...register("supplierId")}
            />
          </Field>
        </div>
      </Card>

      <Card title="Tax">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="GST rate"
            htmlFor="gstRate"
            error={err.gstRate?.message}
            hint="Keep the category's rate unless this product is taxed differently. Selling prices include GST; confirm rates with your CA."
          >
            <Select id="gstRate" {...register("gstRate")}>
              <option value="">{followLabel}</option>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </Field>
          <Field label="HSN code" htmlFor="hsnCode" error={err.hsnCode?.message}>
            <Input id="hsnCode" inputMode="numeric" maxLength={8} {...register("hsnCode")} />
          </Field>
        </div>
      </Card>

      <Card title="Description & notes">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Description" htmlFor="description" error={err.description?.message}>
            <Textarea id="description" rows={4} {...register("description")} />
          </Field>
          <Field label="Internal notes" htmlFor="notes" error={err.notes?.message} hint="Only visible inside the CRM.">
            <Textarea id="notes" rows={4} {...register("notes")} />
          </Field>
        </div>
      </Card>

      <Card title="Website reference">
        <Field
          label="Website product ID"
          htmlFor="websiteProductId"
          error={err.websiteProductId?.message}
          hint="Reference only — the CRM never writes to littlestepz.in. Map variants under Variant Mapping."
        >
          <Input id="websiteProductId" className="font-mono" {...register("websiteProductId")} />
        </Field>
      </Card>
    </div>
  )
}
