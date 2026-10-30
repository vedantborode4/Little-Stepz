"use client"

import clsx from "clsx"
import { Calculator, Info, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHODS,
  CHARGE_TYPE_LABELS,
  CHARGE_TYPES,
  CURRENCIES,
  landedCostInputSchema,
  purchaseDraftSchema,
  RECOVERABLE_BY_DEFAULT,
  type AllocationMethod,
  type ChargeType,
  type CurrencyCode,
  type LandedCostPreviewDto,
  type PurchaseDetailDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card, DetailRow } from "@/components/ui/Display"
import { controlClass, Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatMoney, todayIST } from "@/lib/format"
import { uuid } from "@/lib/uuid"
import { apiErrorsToMap, issuesToErrors } from "@/lib/validation"
import VariantPicker, { type PickedVariant } from "../inventory/VariantPicker"
import { LookupSelect } from "../products/LookupSelect"
import { useSuppliers } from "../products/api"
import { useLocations } from "../settings/api"
import { previewLandedCost, useLastRate, useSaveDraft } from "./api"

interface Line extends PickedVariant {
  quantity: string
  unitPrice: string
  weightKg: string
  cbm: string
}

interface Charge {
  key: string
  type: ChargeType
  description: string
  amount: string
  currency: CurrencyCode
  isRecoverableTax: boolean
}

const PREVIEW_DELAY_MS = 400
const cell = clsx(controlClass, "py-2 px-2.5")

const newCharge = (type: ChargeType = "FREIGHT"): Charge => ({
  key: uuid(),
  type,
  description: "",
  amount: "",
  currency: "INR",
  isRecoverableTax: RECOVERABLE_BY_DEFAULT.has(type),
})

function fromExisting(p?: PurchaseDetailDto) {
  return {
    header: {
      supplierId: p?.supplier.id ?? "",
      invoiceNumber: p?.invoiceNumber ?? "",
      shipmentRef: p?.shipmentRef ?? "",
      invoiceDate: p?.invoiceDate ?? todayIST(),
      locationId: p?.location.id ?? "",
      currency: (p?.currency ?? "INR") as CurrencyCode,
      exchangeRate: p?.exchangeRate ?? "1",
      allocationMethod: (p?.allocationMethod ?? "VALUE") as AllocationMethod,
      notes: p?.notes ?? "",
    },
    lines: (p?.lines ?? []).map(
      (l): Line => ({
        variantId: l.variantId,
        sku: l.sku,
        label: `${l.productName} — ${l.variantName}`,
        quantity: String(l.quantity),
        unitPrice: l.unitPrice ?? "",
        weightKg: l.weightKg ?? "",
        cbm: l.cbm ?? "",
      }),
    ),
    charges: (p?.charges ?? []).map(
      (c): Charge => ({
        key: c.id,
        type: c.type,
        description: c.description ?? "",
        amount: c.amount,
        currency: c.currency as CurrencyCode,
        isRecoverableTax: c.isRecoverableTax,
      }),
    ),
  }
}

export default function PurchaseForm({ purchase }: { purchase?: PurchaseDetailDto }) {
  const router = useRouter()
  const initial = useMemo(() => fromExisting(purchase), [purchase])
  const [header, setHeader] = useState(initial.header)
  const [lines, setLines] = useState<Line[]>(initial.lines)
  const [charges, setCharges] = useState<Charge[]>(initial.charges)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<LandedCostPreviewDto | null>(null)
  const suppliers = useSuppliers({ limit: 100 })
  const locations = useLocations()
  const lastRate = useLastRate(header.currency)
  const save = useSaveDraft()

  const set = (patch: Partial<typeof header>) => setHeader((h) => ({ ...h, ...patch }))
  const isForeign = header.currency !== "INR"
  const needsWeight = header.allocationMethod === "WEIGHT"
  const needsVolume = header.allocationMethod === "VOLUME"

  const landedInput = {
    currency: header.currency,
    exchangeRate: isForeign ? header.exchangeRate : "1",
    allocationMethod: header.allocationMethod,
    lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, weightKg: l.weightKg, cbm: l.cbm })),
    charges: charges.map(({ type, description, amount, currency, isRecoverableTax }) => ({
      type,
      description,
      amount,
      currency,
      isRecoverableTax,
    })),
  }
  const previewKey = JSON.stringify(landedInput)

  // Live landed-cost preview from the server — the same maths that receiving freezes.
  useEffect(() => {
    const parsed = landedCostInputSchema.safeParse(JSON.parse(previewKey))
    if (!parsed.success) {
      setPreview(null)
      return
    }
    let cancelled = false
    const id = setTimeout(() => {
      previewLandedCost(parsed.data)
        .then((p) => !cancelled && setPreview(p))
        .catch(() => !cancelled && setPreview(null))
    }, PREVIEW_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [previewKey])

  const onSupplierChange = (supplierId: string) => {
    const supplier = suppliers.data?.items.find((s) => s.id === supplierId)
    set({ supplierId, ...(supplier && !purchase && { currency: supplier.currency, exchangeRate: supplier.currency === "INR" ? "1" : "" }) })
  }

  const updateLine = (variantId: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)))
  const updateCharge = (key: string, patch: Partial<Charge>) => setCharges((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const submit = async () => {
    setFormError(null)
    const parsed = purchaseDraftSchema.safeParse({ ...header, ...landedInput })
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues))
      setFormError("Some details need attention — see the highlighted fields.")
      return
    }
    setErrors({})
    try {
      const saved = await save.mutateAsync({ id: purchase?.id, input: parsed.data })
      toast.success(`${saved.code} saved as a draft`)
      router.push(`/purchases/${saved.id}`)
    } catch (err) {
      setFormError(errorMessage(err))
      setErrors(apiErrorsToMap(err))
    }
  }

  const err = (key: string) => errors[key]

  return (
    <div className="space-y-4 sm:space-y-5">
      <FormError message={formError} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <Card title="Invoice & shipment" className="xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Supplier" htmlFor="supplierId" required error={err("supplierId")}>
              <LookupSelect
                id="supplierId"
                kind="suppliers"
                canCreate
                placeholder="Choose a supplier"
                value={header.supplierId}
                onChange={(e) => onSupplierChange(e.target.value)}
                onCreated={onSupplierChange}
              />
            </Field>
            <Field label="Receive into" htmlFor="locationId" required error={err("locationId")}>
              <Select id="locationId" value={header.locationId} onChange={(e) => set({ locationId: e.target.value })}>
                <option value="">Choose a location</option>
                {locations.data?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supplier invoice no." htmlFor="invoiceNumber" error={err("invoiceNumber")}>
              <Input id="invoiceNumber" value={header.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
            </Field>
            <Field label="Shipment / BL / AWB ref." htmlFor="shipmentRef" error={err("shipmentRef")}>
              <Input id="shipmentRef" value={header.shipmentRef} onChange={(e) => set({ shipmentRef: e.target.value })} />
            </Field>
            <Field label="Invoice date" htmlFor="invoiceDate" required error={err("invoiceDate")}>
              <Input id="invoiceDate" type="date" value={header.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })} />
            </Field>
            <Field
              label="Split shared charges"
              htmlFor="allocationMethod"
              error={err("allocationMethod")}
              hint="By value is recommended: duty is value-based."
            >
              <Select
                id="allocationMethod"
                value={header.allocationMethod}
                onChange={(e) => set({ allocationMethod: e.target.value as AllocationMethod })}
              >
                {ALLOCATION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {ALLOCATION_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Invoice currency" htmlFor="currency" required error={err("currency")}>
              <Select
                id="currency"
                value={header.currency}
                onChange={(e) => set({ currency: e.target.value as CurrencyCode, exchangeRate: e.target.value === "INR" ? "1" : "" })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={isForeign ? `Exchange rate (₹ per 1 ${header.currency})` : "Exchange rate"}
              htmlFor="exchangeRate"
              required={isForeign}
              error={err("exchangeRate")}
              hint={
                isForeign && lastRate.data ? (
                  <button type="button" className="text-primary hover:underline" onClick={() => set({ exchangeRate: lastRate.data!.rate })}>
                    Use last rate {lastRate.data.rate} ({lastRate.data.code})
                  </button>
                ) : isForeign ? (
                  "The rate you actually paid for this purchase."
                ) : (
                  "INR purchases use 1."
                )
              }
            >
              <Input
                id="exchangeRate"
                inputMode="decimal"
                disabled={!isForeign}
                value={isForeign ? header.exchangeRate : "1"}
                onChange={(e) => set({ exchangeRate: e.target.value })}
              />
            </Field>
            <Field label="Notes" htmlFor="notes" className="md:col-span-2" error={err("notes")}>
              <Textarea id="notes" rows={2} value={header.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Landed cost" action={<Calculator size={16} className="text-faint" />}>
          {preview ? (
            <dl>
              <DetailRow label={`Goods (${header.currency})`}>
                {Number(preview.totals.goodsForeign).toLocaleString("en-IN", { maximumFractionDigits: 4 })}
              </DetailRow>
              <DetailRow label="Goods in ₹">{formatMoney(preview.totals.goodsInr)}</DetailRow>
              <DetailRow label="+ Charges added to cost">{formatMoney(preview.totals.capitalisedCharges)}</DetailRow>
              <DetailRow label="= Landed total">
                <span className="text-base">{formatMoney(preview.totals.landedTotal)}</span>
              </DetailRow>
              <DetailRow label="Input tax credit (not in cost)">{formatMoney(preview.totals.inputTaxCredit)}</DetailRow>
              <DetailRow label="Units">{preview.totals.units}</DetailRow>
            </dl>
          ) : (
            <p className="text-sm text-muted">
              Add items with quantities and prices{isForeign ? ", and the exchange rate," : ""} to see the landed cost.
            </p>
          )}
          <p className="mt-3 flex gap-2 text-xs text-faint">
            <Info size={14} className="shrink-0" /> Frozen when the goods are received. Recoverable GST/IGST is kept out of stock cost.
          </p>
        </Card>
      </div>

      <Card title={`Items (${lines.length})`}>
        <div className="space-y-3">
          <VariantPicker
            excludeIds={new Set(lines.map((l) => l.variantId))}
            onPick={(picked) =>
              setLines((ls) => [
                ...ls,
                ...picked
                  .filter((p) => !ls.some((l) => l.variantId === p.variantId))
                  .map((p) => ({ ...p, quantity: "", unitPrice: "", weightKg: "", cbm: "" })),
              ])
            }
          />
          {err("lines") && <p className="text-xs text-red-500">{err("lines")}</p>}
          {lines.length > 0 && (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    {[
                      "Item",
                      "Qty",
                      `Unit price (${header.currency})`,
                      ...(needsWeight ? ["kg / unit"] : []),
                      ...(needsVolume ? ["CBM / unit"] : []),
                      "Landed / unit",
                      "",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={clsx(
                          "px-3 py-2 text-xs font-semibold uppercase text-muted whitespace-nowrap",
                          i === 0 ? "text-left" : "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const landed = preview?.lines[i]
                    const input = (key: "quantity" | "unitPrice" | "weightKg" | "cbm", label: string, width = "w-24") => (
                      <td className="px-2 py-2 text-right align-top">
                        <input
                          aria-label={`${label} for ${l.sku}`}
                          inputMode="decimal"
                          value={l[key]}
                          onChange={(e) => updateLine(l.variantId, { [key]: e.target.value })}
                          aria-invalid={!!err(`lines.${i}.${key}`)}
                          className={clsx(cell, width, "ml-auto text-right")}
                        />
                        {err(`lines.${i}.${key}`) && <p className="text-[11px] text-red-500 mt-1">{err(`lines.${i}.${key}`)}</p>}
                      </td>
                    )
                    return (
                      <tr key={l.variantId} className="border-t border-border">
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium">{l.label}</p>
                          <p className="text-xs font-mono text-faint">{l.sku}</p>
                        </td>
                        {input("quantity", "Quantity", "w-20")}
                        {input("unitPrice", "Unit price", "w-28")}
                        {needsWeight && input("weightKg", "Weight")}
                        {needsVolume && input("cbm", "Volume")}
                        <td className="px-3 py-2 text-right align-top tabular font-semibold whitespace-nowrap pt-4">
                          {landed ? formatMoney(landed.landedUnitCost) : <span className="text-faint">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right align-top">
                          <Button
                            variant="ghost"
                            icon={<Trash2 size={15} />}
                            aria-label={`Remove ${l.sku}`}
                            onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card
        title={`Charges (${charges.length})`}
        action={
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setCharges((cs) => [...cs, newCharge()])}>
            Add charge
          </Button>
        }
      >
        {charges.length === 0 ? (
          <p className="text-sm text-muted">Freight, customs duty, clearing, IGST and other costs of getting the goods here.</p>
        ) : (
          <ul className="space-y-3">
            {charges.map((c, i) => (
              <li key={c.key} className="grid grid-cols-2 md:grid-cols-[10rem_1fr_8rem_7rem_auto_auto] gap-2 items-start">
                <Select
                  aria-label="Charge type"
                  value={c.type}
                  onChange={(e) =>
                    updateCharge(c.key, {
                      type: e.target.value as ChargeType,
                      isRecoverableTax: RECOVERABLE_BY_DEFAULT.has(e.target.value as ChargeType),
                    })
                  }
                >
                  {CHARGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CHARGE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Description"
                  placeholder="Description (optional)"
                  value={c.description}
                  onChange={(e) => updateCharge(c.key, { description: e.target.value })}
                />
                <div>
                  <Input
                    aria-label="Amount"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={(e) => updateCharge(c.key, { amount: e.target.value })}
                    aria-invalid={!!err(`charges.${i}.amount`)}
                  />
                  {err(`charges.${i}.amount`) && <p className="text-[11px] text-red-500 mt-1">{err(`charges.${i}.amount`)}</p>}
                </div>
                <Select
                  aria-label="Charge currency"
                  value={c.currency}
                  onChange={(e) => updateCharge(c.key, { currency: e.target.value as CurrencyCode })}
                >
                  <option value="INR">INR</option>
                  {isForeign && <option value={header.currency}>{header.currency}</option>}
                </Select>
                <label
                  className="flex items-center gap-2 text-xs text-muted pt-3 whitespace-nowrap"
                  title="Claimable input tax: kept out of stock cost"
                >
                  <input
                    type="checkbox"
                    checked={c.isRecoverableTax}
                    onChange={(e) => updateCharge(c.key, { isRecoverableTax: e.target.checked })}
                    className="accent-[var(--color-primary)]"
                  />
                  Recoverable tax
                </label>
                <Button
                  variant="ghost"
                  icon={<Trash2 size={15} />}
                  aria-label="Remove charge"
                  onClick={() => setCharges((cs) => cs.filter((x) => x.key !== c.key))}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end sticky bottom-20 lg:bottom-4 z-10">
        <div className="flex gap-2 bg-surface/90 backdrop-blur border border-border rounded-2xl p-2 shadow-card">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save draft
          </Button>
        </div>
      </div>
    </div>
  )
}
