"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { LandedCostEntryDto, SetLandedCostPreviewDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { DetailRow, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney } from "@/lib/format"
import { useDebounced } from "@/lib/use-debounced"
import { useLandedCostPreview, useSetLandedCost } from "./api"

const COST = /^\d{1,12}(\.\d{1,2})?$/

const signed = (v: string) => `${Number(v) > 0 ? "+" : ""}${formatMoney(v)}`

function Effect({ p }: { p: SetLandedCostPreviewDto }) {
  const sold = p.filledSoldQty + p.recostedSoldQty
  return (
    <div className="space-y-3">
      <dl className="rounded-xl border border-border px-4">
        <DetailRow label="Stock on hand">
          {p.stockQty === 0 ? (
            "None"
          ) : (
            <>
              {p.stockQty} pcs: {formatMoney(p.stockValueBefore)} → <strong>{formatMoney(p.stockValueAfter)}</strong>
              {p.unknownStockQty > 0 && <span className="block text-xs text-faint">{p.unknownStockQty} of them had no cost</span>}
            </>
          )}
        </DetailRow>
        <DetailRow label="Past sales">
          {sold === 0 ? (
            "None change"
          ) : (
            <>
              {p.orders} sale(s)
              {p.filledSoldQty > 0 && (
                <span className="block text-xs text-muted">{p.filledSoldQty} pcs sold with no cost get this cost</span>
              )}
              {p.recostedSoldQty > 0 && (
                <span className="block text-xs text-muted">{p.recostedSoldQty} pcs costed by an earlier landed cost move to it</span>
              )}
            </>
          )}
        </DetailRow>
        {sold > 0 && (
          <DetailRow label="Gross profit">
            <span className={Number(p.cogsChange) > 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}>
              {signed(String(-Number(p.cogsChange)))}
            </span>
          </DetailRow>
        )}
        {p.commission.length > 0 && (
          <DetailRow label="Commission">
            {p.commission.map((c) => (
              <span key={c.salespersonId} className="block">
                {c.name} <span className="text-xs text-faint">{c.staffCode}</span>: {signed(c.change)}
              </span>
            ))}
          </DetailRow>
        )}
      </dl>
      {p.untouchedHistoricalQty > 0 && (
        <p className="text-xs text-faint">{p.untouchedHistoricalQty} pcs in imported past sales keep their blank cost.</p>
      )}
    </div>
  )
}

export function SetLandedCostModal({
  variantId,
  title,
  currentCost,
  onClose,
}: {
  variantId: string
  title: string
  currentCost: string | null
  onClose: () => void
}) {
  const [unitCost, setUnitCost] = useState("")
  const [reason, setReason] = useState("")
  const trimmed = unitCost.trim()
  const valid = COST.test(trimmed) && Number(trimmed) > 0
  const debounced = useDebounced(valid ? trimmed : null)
  const preview = useLandedCostPreview(variantId, debounced)
  const save = useSetLandedCost()
  const ready = valid && debounced === trimmed && preview.isSuccess && reason.trim().length > 0

  const onSave = async () => {
    try {
      const entry = await save.mutateAsync({ variantId, input: { unitCost: trimmed, reason: reason.trim() } })
      toast.success(`${entry.code}: landed cost set to ${formatMoney(entry.unitCost)}`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      title={`Set landed cost — ${title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={save.isPending} disabled={!ready}>
            Set landed cost
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Landed cost per piece (₹)"
            htmlFor="lc-cost"
            required
            error={trimmed && !valid ? "An amount above 0 with at most 2 decimals" : undefined}
            hint={currentCost ? `Now ${formatMoney(currentCost)} on average` : "Stock on hand has no cost yet"}
          >
            <Input id="lc-cost" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} autoFocus />
          </Field>
          <Field label="Reason" htmlFor="lc-reason" required>
            <Input id="lc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier bill received" />
          </Field>
        </div>

        {valid && preview.isFetching && !preview.data && <Skeleton className="h-28 rounded-xl" />}
        {valid && preview.isError && <FormError message={errorMessage(preview.error)} />}
        {valid && preview.data && <Effect p={preview.data} />}

        <p className="text-xs text-faint">
          Stock on hand in every location moves to this cost. Sales costed from a purchase bill or opening stock with a cost never change.
          This can&apos;t be undone; to correct it, set the cost again.
        </p>
      </div>
    </Modal>
  )
}

export function LandedCostHistory({ entries }: { entries: LandedCostEntryDto[] }) {
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => (
        <li key={e.id} className="py-2 text-sm space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-muted">{e.code}</span>
            <strong>{formatMoney(e.unitCost)}</strong>
            {e.stockQty > 0 && (
              <span className="text-xs text-faint">
                stock was {e.previousUnitCost ? formatMoney(e.previousUnitCost) : "without a cost"}
              </span>
            )}
            <span className="flex-1" />
            <span className="text-xs text-faint">
              {formatDate(e.createdAt)} · {e.createdByName ?? "System"}
            </span>
          </div>
          <p className="text-xs text-muted">
            {e.stockQty} pcs in stock ({signed(e.stockValueChange)}){e.filledSoldQty > 0 && ` · ${e.filledSoldQty} sold pcs costed`}
            {e.recostedSoldQty > 0 && ` · ${e.recostedSoldQty} sold pcs re-costed`}
            {(e.filledSoldQty > 0 || e.recostedSoldQty > 0) && ` · cost of sales ${signed(e.cogsChange)}`}
          </p>
          <p className="text-xs text-faint">
            {e.reason}
            {e.importBatchCode && ` · import ${e.importBatchCode}`}
          </p>
        </li>
      ))}
    </ul>
  )
}
