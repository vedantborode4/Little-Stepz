"use client"

import { CheckCircle2, RotateCcw, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { STOCK_REASON_LABELS, type StockReconciliationDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { DetailRow, EmptyState, Skeleton, StatCard } from "@/components/ui/Display"
import { Field, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useReverseDocument, useStockDocument, useVariantStockCard } from "./api"
import { BucketBadge, DocTypeBadge, LineCost, Qty, StockStateBadge } from "./shared"

/** Records that own a stock entry; their entries are corrected from the record, not here. */
const SOURCE_LABELS: Record<string, string> = {
  PURCHASE: "a purchase",
  PURCHASE_RETURN: "a purchase return",
  SALE: "a sale",
  SALE_RETURN: "a sales return",
  STOCK_COUNT: "a stock count",
  IMPORT: "an import (roll it back from Import Data)",
}

/** Spells out closing stock = opening + in − out so the owner can check the arithmetic. */
function ReconciliationLine({ r }: { r: StockReconciliationDto }) {
  const terms: [string, number, "+" | "−" | "±"][] = [
    ["Opening", r.opening, "+"],
    ["Purchases", r.purchases, "+"],
    ["Sales returns", r.salesReturns, "+"],
    ["Sales", r.sales, "−"],
    ["Purchase returns", r.purchaseReturns, "−"],
    ["Write-offs", r.writeOffs, "−"],
    ["Adjustments", r.adjustments, "±"],
  ]
  const ok = r.computedPhysical === r.actualPhysical
  return (
    <div className="rounded-xl bg-surface-2 p-3 sm:p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {terms.map(([label, value, sign], i) => (
          <span key={label} className="whitespace-nowrap">
            {i > 0 && <span className="text-faint mr-2">{sign}</span>}
            <span className="text-muted">{label}</span> <strong className="tabular">{value}</strong>
          </span>
        ))}
        <span className="whitespace-nowrap">
          <span className="text-faint mr-2">=</span>
          <strong className="tabular">{r.computedPhysical}</strong>
        </span>
      </div>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        {ok ? `Matches physical stock (${r.actualPhysical})` : `Does not match physical stock (${r.actualPhysical}) — report this`}
      </p>
    </div>
  )
}

export function StockCardModal({
  variantId,
  onClose,
  onOpenDocument,
}: {
  variantId: string
  onClose: () => void
  onOpenDocument: (id: string) => void
}) {
  const { data, isLoading } = useVariantStockCard(variantId)
  const s = data?.stock

  return (
    <Modal title={s ? `${s.productName} — ${s.variantName}` : "Stock card"} onClose={onClose} width="max-w-3xl">
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      {s && data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-muted">{s.sku}</span>
            <StockStateBadge state={s.state} />
            {s.reorderLevel > 0 && <span className="text-xs text-faint">Reorder at {s.reorderLevel}</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Physical" value={s.physical} />
            <StatCard title="Available" value={s.available} hint={s.reserved ? `${s.reserved} reserved` : "Sellable − reserved"} />
            <StatCard title="Damaged" value={s.damaged} />
            <StatCard title="Demo" value={s.demo} />
          </div>

          {s.byLocation.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    {["Location", "Sellable", "Damaged", "Demo", "Quarantine"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase text-muted ${i ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.byLocation.map((l) => (
                    <tr key={l.locationId} className="border-t border-border">
                      <td className="px-3 py-2">
                        {l.locationName} <span className="text-xs text-faint font-mono">{l.locationCode}</span>
                      </td>
                      {[l.sellable, l.damaged, l.demo, l.quarantine].map((q, i) => (
                        <td key={i} className="px-3 py-2 text-right tabular">
                          {q}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Reconciliation</h3>
            <ReconciliationLine r={data.reconciliation} />
          </div>

          {s.avgUnitCost !== undefined && (
            <dl className="rounded-xl border border-border px-4">
              <DetailRow label="Average landed cost">{s.avgUnitCost ? formatMoney(s.avgUnitCost) : "Unknown"}</DetailRow>
              <DetailRow label="Stock value (known cost)">{formatMoney(s.stockValue)}</DetailRow>
              {(s.unvaluedQty ?? 0) > 0 && (
                <DetailRow label="Units with unknown cost">
                  <span className="text-yellow-700 dark:text-yellow-400">{s.unvaluedQty} — not valued, never guessed</span>
                </DetailRow>
              )}
            </dl>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Recent movements</h3>
            {data.recent.length === 0 ? (
              <EmptyState title="No movements yet" hint="Record opening stock to start this item's ledger." />
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <button className="font-mono text-xs text-primary hover:underline" onClick={() => onOpenDocument(m.documentId)}>
                      {m.documentCode}
                    </button>
                    <DocTypeBadge type={m.type} />
                    <span className="text-xs text-muted">
                      {m.locationCode} · <BucketBadge bucket={m.bucket} />
                    </span>
                    <span className="flex-1 text-xs text-muted truncate">{m.reason}</span>
                    <Qty value={m.quantity} />
                    <span className="text-xs text-faint w-24 text-right">{formatDate(m.businessDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export function StockDocumentModal({
  documentId,
  onClose,
  onOpenDocument,
}: {
  documentId: string
  onClose: () => void
  onOpenDocument: (id: string) => void
}) {
  const can = useCan()
  const { data, isLoading } = useStockDocument(documentId)
  const reverse = useReverseDocument()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState("")

  const onReverse = async () => {
    try {
      const reversal = await reverse.mutateAsync({ id: documentId, input: { reason } })
      toast.success(`Reversed by ${reversal.code}`)
      setConfirming(false)
      onOpenDocument(reversal.id)
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirming(false)
    }
  }

  return (
    <Modal
      title={data ? data.code : "Stock document"}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        data?.canReverse && can("inventory.adjust") ? (
          <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => setConfirming(true)}>
            Reverse this entry
          </Button>
        ) : undefined
      }
    >
      {isLoading && <Skeleton className="h-48 rounded-xl" />}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <DocTypeBadge type={data.type} />
            {data.reversedBy && (
              <button onClick={() => onOpenDocument(data.reversedBy!.id)} className="text-xs text-red-500 hover:underline">
                Reversed by {data.reversedBy.code}
              </button>
            )}
            {data.reversalOf && (
              <button onClick={() => onOpenDocument(data.reversalOf!.id)} className="text-xs text-primary hover:underline">
                Reverses {data.reversalOf.code}
              </button>
            )}
          </div>
          <dl className="rounded-xl border border-border px-4">
            <DetailRow label="Date">{formatDate(data.businessDate)}</DetailRow>
            <DetailRow label="Reason">
              {data.reasonCode ? `${STOCK_REASON_LABELS[data.reasonCode]} — ${data.reason}` : data.reason}
            </DetailRow>
            {data.reference && <DetailRow label="Reference">{data.reference}</DetailRow>}
            {data.notes && <DetailRow label="Notes">{data.notes}</DetailRow>}
            <DetailRow label="Recorded by">
              {data.createdByName ?? "System"} · {formatDateTime(data.createdAt)}
            </DetailRow>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2">
                <tr>
                  {["Item", "Location", "Status", "Qty", ...(data.lines.some((l) => l.unitCost !== undefined) ? ["Unit cost"] : [])].map(
                    (h, i) => (
                      <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase text-muted ${i >= 3 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {l.productName} — {l.variantName}
                      </p>
                      <p className="text-xs font-mono text-faint">{l.sku}</p>
                    </td>
                    <td className="px-3 py-2">{l.locationCode}</td>
                    <td className="px-3 py-2">
                      <BucketBadge bucket={l.bucket} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Qty value={l.quantity} />
                    </td>
                    {l.unitCost !== undefined && (
                      <td className="px-3 py-2 text-right">
                        <LineCost unitCost={l.unitCost} effectiveType={data.effectiveType} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.sourceType && (
            <p className="text-xs text-faint">
              Created by {SOURCE_LABELS[data.sourceType] ?? data.sourceType.toLowerCase()}; correct it from there.
            </p>
          )}
        </div>
      )}
      {confirming && data && (
        <ConfirmDialog
          title={`Reverse ${data.code}?`}
          confirmLabel="Reverse"
          loading={reverse.isPending}
          confirmDisabled={reason.trim().length === 0}
          onCancel={() => setConfirming(false)}
          onConfirm={onReverse}
          message={
            <div className="space-y-3">
              <p>
                A new entry will undo every line of {data.code} at its original cost. The original stays in the ledger, and this can&apos;t
                be reversed again.
              </p>
              <Field label="Reason" htmlFor="rev-reason" required>
                <Input
                  id="rev-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Entered at the wrong location"
                />
              </Field>
            </div>
          }
        />
      )}
    </Modal>
  )
}
