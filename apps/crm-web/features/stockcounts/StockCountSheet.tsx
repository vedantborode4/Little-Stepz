"use client"

import clsx from "clsx"
import { CheckCircle2, Save, Send, Undo2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { STOCK_REASON_CODES, STOCK_REASON_LABELS, type StockCountDetailDto, type StockReasonCode } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, Input, Select, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { StockDocumentModal } from "../inventory/StockModals"
import VariantPicker from "../inventory/VariantPicker"
import { useAddCountLine, useApproveCount, useCountAction, useSaveCounts, useStockCount, type CountAction } from "./api"
import { CountStatusBadge } from "./StockCountsList"

type Dialog = { action: CountAction | "approve"; title: string; message: string; confirm: string; tone: "danger" | "primary" }

const DIALOGS: Record<CountAction | "approve", Omit<Dialog, "action">> = {
  submit: {
    title: "Submit this count?",
    message: "It goes to an approver. Counts can't be changed unless it's sent back.",
    confirm: "Submit",
    tone: "primary",
  },
  cancel: {
    title: "Cancel this count?",
    message: "Nothing is posted. The count stays on record as cancelled.",
    confirm: "Cancel count",
    tone: "danger",
  },
  "send-back": {
    title: "Send back for a recount?",
    message: "The counter can change the figures and submit again.",
    confirm: "Send back",
    tone: "primary",
  },
  approve: {
    title: "Approve and post the differences?",
    message: "One stock adjustment is posted for every difference: found units in, missing units out, at the current average cost.",
    confirm: "Approve",
    tone: "primary",
  },
  reverse: {
    title: "Reverse this count?",
    message: "A reversal document puts stock back to what it was before the adjustment.",
    confirm: "Reverse",
    tone: "danger",
  },
}

function Sheet({ c }: { c: StockCountDetailDto }) {
  const can = useCan()
  const save = useSaveCounts(c.id)
  const addLine = useAddCountLine(c.id)
  const run = useCountAction(c.id)
  const approve = useApproveCount(c.id)
  const [entries, setEntries] = useState<Record<string, string>>(
    Object.fromEntries(c.lines.map((l) => [l.id, l.countedQty === null ? "" : String(l.countedQty)])),
  )
  const [reasons, setReasons] = useState<Record<string, StockReasonCode>>({})
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [reason, setReason] = useState("")
  const [documentId, setDocumentId] = useState<string | null>(null)
  const isOpen = c.status === "OPEN"
  const approver = can("stockcount.approve")
  const reviewing = c.status === "SUBMITTED" && approver
  const dirty = c.lines.some((l) => (l.countedQty === null ? "" : String(l.countedQty)) !== entries[l.id])

  const saveAll = async () => {
    const lines = c.lines
      .filter((l) => (l.countedQty === null ? "" : String(l.countedQty)) !== entries[l.id])
      .map((l) => ({ lineId: l.id, countedQty: entries[l.id]!.trim() === "" ? null : Number(entries[l.id]) }))
    if (lines.length === 0) return
    await save.mutateAsync({ lines })
  }

  const confirm = async () => {
    if (!dialog) return
    try {
      if (dialog.action === "approve") {
        await approve.mutateAsync({
          reason: reason.trim(),
          lines: Object.entries(reasons).map(([lineId, reasonCode]) => ({ lineId, reasonCode })),
        })
      } else {
        if (dialog.action === "submit" && dirty) await saveAll()
        const needsReason = dialog.action !== "submit"
        await run.mutateAsync({ action: dialog.action, reason: needsReason ? reason.trim() : undefined })
      }
      toast.success(dialog.confirm)
      setDialog(null)
      setReason("")
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  const open = (action: Dialog["action"]) => setDialog({ action, ...DIALOGS[action] })
  const needsReasonText = dialog && dialog.action !== "submit"

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`${c.code} · ${c.location.name}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <CountStatusBadge status={c.status} />
            <span>
              {c.category?.name ?? "All categories"} · {c.blind ? "Blind" : "Open"} count · started {formatDate(c.createdAt)} by{" "}
              {c.createdByName ?? "—"}
            </span>
          </span>
        }
        action={
          <>
            {isOpen && (
              <Button
                variant="secondary"
                icon={<Save size={15} />}
                disabled={!dirty}
                loading={save.isPending}
                onClick={() =>
                  saveAll().then(
                    () => toast.success("Counts saved"),
                    (err) => toast.error(errorMessage(err)),
                  )
                }
              >
                Save
              </Button>
            )}
            {isOpen && (
              <Button icon={<Send size={15} />} onClick={() => open("submit")}>
                Submit
              </Button>
            )}
            {reviewing && (
              <Button variant="secondary" onClick={() => open("send-back")}>
                Send back
              </Button>
            )}
            {reviewing && (
              <Button icon={<CheckCircle2 size={16} />} onClick={() => open("approve")}>
                Approve
              </Button>
            )}
            {c.status === "APPROVED" && approver && c.adjustmentDocument && (
              <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => open("reverse")}>
                Reverse
              </Button>
            )}
            {(isOpen || reviewing) && (
              <Button variant="ghost" onClick={() => open("cancel")}>
                Cancel count
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          Counted {c.counted} of {c.lineCount}
        </span>
        {c.showSystem && c.unitsOver !== undefined && (
          <span>
            Differences: <span className="text-green-600 dark:text-green-400">+{c.unitsOver}</span> /{" "}
            <span className="text-red-500">−{c.unitsShort}</span>
          </span>
        )}
        {c.valueImpact !== undefined && c.valueImpact !== null && <span>Value at average cost: {formatMoney(c.valueImpact)}</span>}
        {c.submittedAt && (
          <span>
            Submitted {formatDateTime(c.submittedAt)} by {c.submittedByName}
          </span>
        )}
        {c.adjustmentDocument && (
          <button className="text-primary hover:underline" onClick={() => setDocumentId(c.adjustmentDocument!.id)}>
            Adjustment {c.adjustmentDocument.code}
          </button>
        )}
        {c.reversalDocument && (
          <button className="text-primary hover:underline" onClick={() => setDocumentId(c.reversalDocument!.id)}>
            Reversal {c.reversalDocument.code}
          </button>
        )}
        {c.cancelReason && <span>Cancelled: {c.cancelReason}</span>}
      </div>

      {isOpen && (
        <div className="max-w-xl">
          <VariantPicker
            excludeIds={new Set(c.lines.map((l) => l.variantId))}
            onPick={(picked) => picked[0] && addLine.mutateAsync(picked[0].variantId).catch((err) => toast.error(errorMessage(err)))}
          />
          <p className="mt-1 text-xs text-faint">Found something that isn&apos;t on the list? Add it here.</p>
        </div>
      )}

      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left">Item</th>
                {c.showSystem && <th className="px-4 py-2.5 text-right">System</th>}
                <th className="px-4 py-2.5 text-right">Counted</th>
                {c.showSystem && <th className="px-4 py-2.5 text-right">Difference</th>}
                {(reviewing || c.status === "APPROVED" || c.status === "REVERSED") && <th className="px-4 py-2.5 text-left">Reason</th>}
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l) => {
                const variance = l.variance ?? null
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {l.productName} — {l.variantName}
                      </p>
                      <p className="text-xs font-mono text-faint">{l.sku}</p>
                    </td>
                    {c.showSystem && <td className="px-4 py-2.5 text-right tabular text-muted">{l.systemQty}</td>}
                    <td className="px-4 py-2.5 text-right">
                      {isOpen ? (
                        <div className="w-24 ml-auto">
                          <Input
                            aria-label={`Counted ${l.sku}`}
                            inputMode="numeric"
                            value={entries[l.id] ?? ""}
                            onChange={(e) => setEntries((s) => ({ ...s, [l.id]: e.target.value.replace(/\D/g, "") }))}
                            className="py-1.5 text-right tabular"
                          />
                        </div>
                      ) : (
                        <span className="tabular">{l.countedQty ?? "—"}</span>
                      )}
                    </td>
                    {c.showSystem && (
                      <td
                        className={clsx(
                          "px-4 py-2.5 text-right tabular font-semibold",
                          variance === null || variance === 0
                            ? "text-faint"
                            : variance > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-500",
                        )}
                      >
                        {variance === null ? "—" : variance > 0 ? `+${variance}` : variance}
                      </td>
                    )}
                    {(reviewing || c.status === "APPROVED" || c.status === "REVERSED") && (
                      <td className="px-4 py-2.5">
                        {variance ? (
                          reviewing ? (
                            <Select
                              aria-label={`Reason for ${l.sku}`}
                              value={reasons[l.id] ?? "COUNT_CORRECTION"}
                              onChange={(e) => setReasons((s) => ({ ...s, [l.id]: e.target.value as StockReasonCode }))}
                              className="py-1.5"
                            >
                              {STOCK_REASON_CODES.map((r) => (
                                <option key={r} value={r}>
                                  {STOCK_REASON_LABELS[r]}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-muted">{l.reasonCode ? STOCK_REASON_LABELS[l.reasonCode] : "—"}</span>
                          )
                        ) : null}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={
            <div className="space-y-3">
              <p>{dialog.message}</p>
              {needsReasonText && (
                <Field label="Reason" htmlFor="count-reason" required>
                  <Textarea id="count-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
            </div>
          }
          confirmLabel={dialog.confirm}
          tone={dialog.tone}
          confirmDisabled={Boolean(needsReasonText) && !reason.trim()}
          loading={run.isPending || approve.isPending || save.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={confirm}
        />
      )}
      {documentId && <StockDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} onOpenDocument={setDocumentId} />}
    </div>
  )
}

export default function StockCountSheet({ id }: { id: string }) {
  const { data, isLoading } = useStockCount(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Count not found" />
  return <Sheet key={`${data.id}-${data.status}-${data.lineCount}`} c={data} />
}
