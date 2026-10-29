"use client"

import clsx from "clsx"
import { AlertTriangle, Eye } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  BULK_PRICE_OPERATION_LABELS,
  BULK_PRICE_OPERATIONS,
  bulkPricePreviewSchema,
  PRICE_FIELD_LABELS,
  PRICE_FIELDS,
  type BulkPricePreviewInput,
  type BulkPricePreviewRowDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatMoney } from "@/lib/format"
import { useApiForm } from "@/lib/use-api-form"
import { previewBulkPrice, useApplyBulkPrice, useNamedList } from "./api"
import CatalogTabs from "./CatalogTabs"

function change(oldPrice: string | null, newPrice: string | null) {
  if (!oldPrice || !newPrice) return null
  const pct = ((Number(newPrice) - Number(oldPrice)) / Number(oldPrice)) * 100
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`
}

/** Preview first, then apply exactly the valid rows shown; the server rejects the batch if any price moved meanwhile. */
export default function BulkPriceEditor() {
  const categories = useNamedList("categories")
  const brands = useNamedList("brands")
  const apply = useApplyBulkPrice()
  const [preview, setPreview] = useState<{ input: BulkPricePreviewInput; rows: BulkPricePreviewRowDto[] } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState("")

  const { form, formError, submitWith } = useApiForm(bulkPricePreviewSchema, {
    categoryId: undefined,
    brandId: undefined,
    q: "",
    field: "OFFER",
    operation: "PERCENT_OFF_REGULAR",
    value: "",
    roundToRupee: true,
  })
  const { register, formState, watch } = form
  const operation = watch("operation")

  const onPreview = submitWith(async (values) => {
    const input = { ...values, categoryId: values.categoryId || undefined, brandId: values.brandId || undefined, q: values.q || undefined }
    setPreview({ input, rows: await previewBulkPrice(input) })
  })

  const valid = preview?.rows.filter((r) => !r.error) ?? []
  const invalid = preview?.rows.filter((r) => r.error) ?? []

  const onApply = async () => {
    if (!preview) return
    try {
      const result = await apply.mutateAsync({
        field: preview.input.field,
        reason: reason || null,
        changes: valid.map((r) => ({ variantId: r.variantId, expectedOldPrice: r.oldPrice, newPrice: r.newPrice })),
      })
      toast.success(`${result.updated} prices updated`)
      setPreview(null)
      setConfirming(false)
      setReason("")
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirming(false)
    }
  }

  return (
    <div>
      <PageHeader title="Products" subtitle="Change many prices at once. Nothing is saved until you confirm the preview." />
      <CatalogTabs />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <form onSubmit={onPreview} noValidate>
          <Card title="1. Choose products and the change">
            <div className="space-y-4">
              <FormError message={formError} />
              <Field label="Category" htmlFor="b-category">
                <Select id="b-category" {...register("categoryId")}>
                  <option value="">All categories</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Brand" htmlFor="b-brand">
                <Select id="b-brand" {...register("brandId")}>
                  <option value="">All brands</option>
                  {brands.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Product name or code contains" htmlFor="b-q">
                <Input id="b-q" {...register("q")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price" htmlFor="b-field">
                  <Select id="b-field" {...register("field")}>
                    {PRICE_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {PRICE_FIELD_LABELS[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Change" htmlFor="b-op" error={formState.errors.operation?.message}>
                  <Select id="b-op" {...register("operation")}>
                    {BULK_PRICE_OPERATIONS.map((o) => (
                      <option key={o} value={o}>
                        {BULK_PRICE_OPERATION_LABELS[o]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {operation !== "CLEAR" && (
                <Field
                  label={operation?.includes("PERCENT") ? "Percent" : "Amount ₹"}
                  htmlFor="b-value"
                  error={formState.errors.value?.message}
                >
                  <Input id="b-value" inputMode="decimal" {...register("value")} />
                </Field>
              )}
              <Checkbox id="b-round" label="Round to whole rupees" {...register("roundToRupee")} />
              <Button type="submit" className="w-full" icon={<Eye size={16} />} loading={formState.isSubmitting}>
                Preview changes
              </Button>
            </div>
          </Card>
        </form>

        <div className="xl:col-span-2 space-y-4">
          {!preview && (
            <Card>
              <EmptyState
                title="2. Review the preview here"
                hint="You'll see every variant's current and new price before anything changes."
              />
            </Card>
          )}
          {preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard title="Will change" value={valid.length} />
                <StatCard
                  title="Blocked"
                  value={invalid.length}
                  color="bg-red-50 text-red-500"
                  icon={invalid.length ? <AlertTriangle size={16} /> : undefined}
                />
                <StatCard title="Price" value={<span className="text-base">{PRICE_FIELD_LABELS[preview.input.field]}</span>} />
              </div>
              <Card
                title="2. Review"
                action={
                  <Button disabled={valid.length === 0} onClick={() => setConfirming(true)}>
                    Apply {valid.length} change{valid.length === 1 ? "" : "s"}
                  </Button>
                }
              >
                {preview.rows.length === 0 ? (
                  <EmptyState title="Nothing would change" hint="Every matching price already has this value." />
                ) : (
                  <div className="overflow-x-auto -m-4 sm:-m-5">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-2">
                        <tr>
                          {["Product", "SKU", "Current", "New", "Change"].map((h, i) => (
                            <th
                              key={h}
                              className={clsx(
                                "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                                i >= 2 ? "text-right" : "text-left",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r) => (
                          <tr key={r.variantId} className={clsx("border-t border-border", r.error && "bg-red-50/60 dark:bg-red-500/5")}>
                            <td className="px-4 py-2.5">
                              <p className="font-medium">{r.productName}</p>
                              <p className="text-xs text-muted">{r.variantName}</p>
                              {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error} — will be skipped</p>}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.sku}</td>
                            <td className="px-4 py-2.5 text-right tabular text-muted">{r.oldPrice ? formatMoney(r.oldPrice) : "—"}</td>
                            <td className="px-4 py-2.5 text-right tabular font-semibold">
                              {r.newPrice ? formatMoney(r.newPrice) : "removed"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular text-xs text-muted">{change(r.oldPrice, r.newPrice) ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {confirming && preview && (
        <ConfirmDialog
          title={`Update ${valid.length} ${PRICE_FIELD_LABELS[preview.input.field].toLowerCase()}s?`}
          tone="primary"
          confirmLabel="Apply changes"
          loading={apply.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={onApply}
          message={
            <div className="space-y-3">
              <p>
                New prices apply to future sales only. Completed sales keep the price they were sold at, and every change is saved in the
                price history.
              </p>
              <Field label="Reason (optional)" htmlFor="b-reason">
                <Input id="b-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali sale" />
              </Field>
            </div>
          }
        />
      )}
    </div>
  )
}
