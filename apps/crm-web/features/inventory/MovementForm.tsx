"use client"

import clsx from "clsx"
import { ArrowRight, CheckCircle2, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"
import {
  adjustmentSchema,
  bucketMoveSchema,
  openingStockSchema,
  STOCK_BUCKET_LABELS,
  STOCK_BUCKETS,
  STOCK_REASON_CODES,
  STOCK_REASON_LABELS,
  transferSchema,
  writeOffSchema,
  type StockBucket,
  type StockDocumentDto,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card, PageHeader } from "@/components/ui/Display"
import { controlClass, Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import { errorMessage, isApiError } from "@/lib/api-error"
import { todayIST } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useLocations } from "../settings/api"
import { usePostMovement, type MovementInput, type MovementKind } from "./api"
import { InventoryTabs } from "./shared"
import { StockDocumentModal } from "./StockModals"
import VariantPicker, { type PickedVariant } from "./VariantPicker"

interface Line extends PickedVariant {
  quantity: string
  unitCost: string
  /** Adjustments only: whether units are being added (found) or removed (missing). */
  direction: "add" | "remove"
}

const KINDS: { kind: MovementKind; label: string; permission: "inventory.move" | "inventory.adjust"; help: string }[] = [
  {
    kind: "opening",
    label: "Opening stock",
    permission: "inventory.adjust",
    help: "Starting quantities for items with no stock history yet. Leave the cost blank if you don't know it — it stays unknown and is never guessed.",
  },
  {
    kind: "transfer",
    label: "Transfer",
    permission: "inventory.move",
    help: "Move units between locations, e.g. Godown → Store. Total stock doesn't change.",
  },
  {
    kind: "status",
    label: "Status change",
    permission: "inventory.move",
    help: "Mark units as damaged, demo or quarantined, or return them to sellable. Physical stock stays the same; sellable stock changes.",
  },
  {
    kind: "write-off",
    label: "Write-off",
    permission: "inventory.adjust",
    help: "Remove units that are gone — missing, stolen or disposed of. Costed at the average landed cost.",
  },
  {
    kind: "adjustment",
    label: "Adjustment",
    permission: "inventory.adjust",
    help: "Correct physical stock to match reality: add found units or remove missing ones. Found units come in at the average cost.",
  },
]

const SCHEMAS: Record<MovementKind, z.ZodType> = {
  opening: openingStockSchema,
  transfer: transferSchema,
  status: bucketMoveSchema,
  "write-off": writeOffSchema,
  adjustment: adjustmentSchema,
}

const emptyHeader = () => ({
  locationId: "",
  fromLocationId: "",
  toLocationId: "",
  bucket: "SELLABLE" as StockBucket,
  fromBucket: "SELLABLE" as StockBucket,
  toBucket: "DAMAGED" as StockBucket,
  reasonCode: "",
  reason: "",
  businessDate: todayIST(),
  reference: "",
  notes: "",
})

function buildPayload(kind: MovementKind, h: ReturnType<typeof emptyHeader>, lines: Line[]) {
  const common = { businessDate: h.businessDate || undefined, reference: h.reference, notes: h.notes }
  const qtyLines = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
  switch (kind) {
    case "opening":
      return {
        ...common,
        locationId: h.locationId,
        bucket: h.bucket,
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
      }
    case "transfer":
      return {
        ...common,
        fromLocationId: h.fromLocationId,
        toLocationId: h.toLocationId,
        bucket: h.bucket,
        reason: h.reason,
        lines: qtyLines,
      }
    case "status":
      return {
        ...common,
        locationId: h.locationId,
        fromBucket: h.fromBucket,
        toBucket: h.toBucket,
        reasonCode: h.reasonCode || undefined,
        reason: h.reason,
        lines: qtyLines,
      }
    case "write-off":
      return {
        ...common,
        locationId: h.locationId,
        bucket: h.bucket,
        reasonCode: h.reasonCode || undefined,
        reason: h.reason,
        lines: qtyLines,
      }
    case "adjustment":
      return {
        ...common,
        locationId: h.locationId,
        bucket: h.bucket,
        reasonCode: h.reasonCode || undefined,
        reason: h.reason,
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.direction === "remove" ? `-${l.quantity}` : l.quantity })),
      }
  }
}

function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join(".")
    out[key] ??= issue.message
  }
  return out
}

export default function MovementForm({ initialKind }: { initialKind?: MovementKind }) {
  const can = useCan()
  const allowed = KINDS.filter((k) => can(k.permission))
  const [kind, setKind] = useState<MovementKind>(
    allowed.some((k) => k.kind === initialKind) ? initialKind! : (allowed[0]?.kind ?? "transfer"),
  )
  const [header, setHeader] = useState(emptyHeader)
  const [lines, setLines] = useState<Line[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [posted, setPosted] = useState<StockDocumentDto | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const locations = useLocations()
  const post = usePostMovement(kind)
  const meta = KINDS.find((k) => k.kind === kind)!

  const set = (patch: Partial<ReturnType<typeof emptyHeader>>) => setHeader((h) => ({ ...h, ...patch }))
  const updateLine = (variantId: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)))
  const addLines = (picked: PickedVariant[]) =>
    setLines((ls) => [
      ...ls,
      ...picked
        .filter((p) => !ls.some((l) => l.variantId === p.variantId))
        .map((p) => ({ ...p, quantity: "", unitCost: "", direction: "add" as const })),
    ])

  const switchKind = (next: MovementKind) => {
    setKind(next)
    setErrors({})
    setFormError(null)
    setPosted(null)
  }

  const submit = async () => {
    setFormError(null)
    const payload = buildPayload(kind, header, lines)
    const parsed = SCHEMAS[kind].safeParse(payload)
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues))
      return
    }
    setErrors({})
    try {
      const doc = await post.mutateAsync(parsed.data as MovementInput[typeof kind])
      toast.success(`${doc.code} recorded`)
      setPosted(doc)
      setLines([])
      setHeader((h) => ({ ...emptyHeader(), locationId: h.locationId, fromLocationId: h.fromLocationId, toLocationId: h.toLocationId }))
    } catch (err) {
      setFormError(errorMessage(err))
      if (isApiError(err)) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])))
    }
  }

  const locationSelect = (id: string, value: string, onChange: (v: string) => void, error?: string, label = "Location") => (
    <Field label={label} htmlFor={id} required error={error}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {locations.data?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    </Field>
  )
  const bucketSelect = (id: string, label: string, value: StockBucket, onChange: (v: StockBucket) => void, error?: string) => (
    <Field label={label} htmlFor={id} error={error}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as StockBucket)}>
        {STOCK_BUCKETS.map((b) => (
          <option key={b} value={b}>
            {STOCK_BUCKET_LABELS[b]}
          </option>
        ))}
      </Select>
    </Field>
  )
  const needsReasonCode = kind === "write-off" || kind === "adjustment"

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Every entry is permanent. Mistakes are corrected by reversing the entry, never by editing it."
      />
      <InventoryTabs />

      <div className="flex gap-1 overflow-x-auto scrollbar-none mb-4 p-1 bg-surface border border-border rounded-2xl w-fit max-w-full">
        {allowed.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => switchKind(k.kind)}
            className={clsx(
              "px-3 sm:px-4 py-2 rounded-xl text-sm whitespace-nowrap transition",
              kind === k.kind ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-2",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {posted && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-4 mb-4 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 size={18} />
          <span className="flex-1">
            <strong>{posted.code}</strong> recorded with {posted.lines.length} line{posted.lines.length === 1 ? "" : "s"}.
          </span>
          <Button size="sm" variant="secondary" onClick={() => setViewing(posted.id)}>
            View entry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <Card title={meta.label}>
          <div className="space-y-4">
            <p className="text-sm text-muted">{meta.help}</p>
            {kind === "transfer" ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                {locationSelect("from", header.fromLocationId, (v) => set({ fromLocationId: v }), errors.fromLocationId, "From")}
                <ArrowRight size={18} className="mb-3 text-faint" />
                {locationSelect("to", header.toLocationId, (v) => set({ toLocationId: v }), errors.toLocationId, "To")}
              </div>
            ) : (
              locationSelect("loc", header.locationId, (v) => set({ locationId: v }), errors.locationId)
            )}
            {kind === "status" ? (
              <div className="grid grid-cols-2 gap-3">
                {bucketSelect("fromBucket", "From status", header.fromBucket, (v) => set({ fromBucket: v }), errors.fromBucket)}
                {bucketSelect("toBucket", "To status", header.toBucket, (v) => set({ toBucket: v }), errors.toBucket)}
              </div>
            ) : (
              kind !== "opening" && bucketSelect("bucket", "Stock status", header.bucket, (v) => set({ bucket: v }), errors.bucket)
            )}
            {(needsReasonCode || kind === "status") && (
              <Field label="Reason type" htmlFor="reasonCode" required={needsReasonCode} error={errors.reasonCode}>
                <Select id="reasonCode" value={header.reasonCode} onChange={(e) => set({ reasonCode: e.target.value })}>
                  <option value="">Choose…</option>
                  {STOCK_REASON_CODES.map((r) => (
                    <option key={r} value={r}>
                      {STOCK_REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {kind !== "opening" && (
              <Field label="Reason" htmlFor="reason" required error={errors.reason}>
                <Input id="reason" value={header.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="What happened?" />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="businessDate" error={errors.businessDate}>
                <Input
                  id="businessDate"
                  type="date"
                  max={todayIST()}
                  value={header.businessDate}
                  onChange={(e) => set({ businessDate: e.target.value })}
                />
              </Field>
              <Field label="Reference" htmlFor="reference" error={errors.reference}>
                <Input
                  id="reference"
                  value={header.reference}
                  onChange={(e) => set({ reference: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field label="Notes" htmlFor="notes" error={errors.notes}>
              <Textarea id="notes" rows={2} value={header.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </Card>

        <div className="xl:col-span-2 space-y-4">
          <Card title={`Items (${lines.length})`}>
            <div className="space-y-4">
              <FormError message={formError} />
              <VariantPicker onPick={addLines} excludeIds={new Set(lines.map((l) => l.variantId))} />
              {errors.lines && <p className="text-xs text-red-500">{errors.lines}</p>}
              {lines.length > 0 && (
                <ul className="divide-y divide-border">
                  {lines.map((l, i) => {
                    const qtyError = errors[`lines.${i}.quantity`]
                    const costError = errors[`lines.${i}.unitCost`]
                    return (
                      <li key={l.variantId} className="py-3 flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[12rem]">
                          <p className="text-sm font-medium">{l.label}</p>
                          <p className="text-xs font-mono text-faint">{l.sku}</p>
                          {errors[`lines.${i}.variantId`] && <p className="text-xs text-red-500">{errors[`lines.${i}.variantId`]}</p>}
                        </div>
                        {kind === "adjustment" && (
                          <Select
                            aria-label="Add or remove"
                            className="w-32"
                            value={l.direction}
                            onChange={(e) => updateLine(l.variantId, { direction: e.target.value as Line["direction"] })}
                          >
                            <option value="add">+ Add</option>
                            <option value="remove">− Remove</option>
                          </Select>
                        )}
                        <div className="w-24">
                          <input
                            aria-label={`Quantity for ${l.sku}`}
                            inputMode="numeric"
                            placeholder="Qty"
                            value={l.quantity}
                            onChange={(e) => updateLine(l.variantId, { quantity: e.target.value })}
                            aria-invalid={!!qtyError}
                            className={clsx(controlClass, "py-2")}
                          />
                          {qtyError && <p className="text-[11px] text-red-500 mt-1">{qtyError}</p>}
                        </div>
                        {kind === "opening" && (
                          <div className="w-32">
                            <input
                              aria-label={`Unit cost for ${l.sku}`}
                              inputMode="decimal"
                              placeholder="Cost ₹ (optional)"
                              value={l.unitCost}
                              onChange={(e) => updateLine(l.variantId, { unitCost: e.target.value })}
                              aria-invalid={!!costError}
                              className={clsx(controlClass, "py-2")}
                            />
                            {costError && <p className="text-[11px] text-red-500 mt-1">{costError}</p>}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          icon={<Trash2 size={15} />}
                          aria-label={`Remove ${l.sku}`}
                          onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" disabled={lines.length === 0 || post.isPending} onClick={() => setLines([])}>
                  Clear
                </Button>
                <Button loading={post.isPending} disabled={lines.length === 0} onClick={submit}>
                  Record {meta.label.toLowerCase()}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {viewing && <StockDocumentModal documentId={viewing} onClose={() => setViewing(null)} onOpenDocument={setViewing} />}
    </div>
  )
}
