"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { RETURN_CONDITION_LABELS, RETURN_CONDITIONS, type ReturnCondition, type SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatMoney } from "@/lib/format"
import { useDebounced } from "@/lib/use-debounced"
import { useCan } from "@/store/auth.store"
import { AccountSelect } from "../payments/shared"
import { previewReturn, useCreateReturn } from "./api"

type LineChoice = { quantity: string; condition: ReturnCondition }

/** Pick what's coming back and in what state; the server previews the value and any money owed back. */
export default function ReturnModal({ order, onClose }: { order: SalesOrderDetailDto; onClose: () => void }) {
  const can = useCan()
  const create = useCreateReturn(order.id)
  const returnable = order.lines.filter((l) => l.quantity > l.returnedQty)
  const [choices, setChoices] = useState<Record<string, LineChoice>>(
    Object.fromEntries(returnable.map((l) => [l.id, { quantity: "", condition: "RESELLABLE" as ReturnCondition }])),
  )
  const [shippingRefund, setShippingRefund] = useState("")
  const [reason, setReason] = useState("")
  const [method, setMethod] = useState<"REFUND" | "CREDIT">(order.customer ? "CREDIT" : "REFUND")
  const [accountId, setAccountId] = useState("")
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)

  const lines = Object.entries(choices)
    .filter(([, c]) => Number(c.quantity) > 0)
    .map(([orderLineId, c]) => ({ orderLineId, quantity: Number(c.quantity), condition: c.condition }))
  const request = useDebounced({ lines, shippingRefund: shippingRefund.trim() || "0" }, 300)
  const preview = useQuery({
    queryKey: ["returns", "preview", order.id, request],
    queryFn: () => previewReturn(order.id, request),
    enabled: request.lines.length > 0,
    retry: false,
  })
  const p = request.lines.length > 0 ? preview.data : undefined
  const refundDue = Number(p?.refundDue ?? 0) > 0
  const ready = lines.length > 0 && reason.trim() && !preview.isFetching && p && (!refundDue || method === "CREDIT" || accountId)

  const submit = async () => {
    setError(null)
    try {
      const saved = await create.mutateAsync({
        lines,
        shippingRefund: shippingRefund.trim() || "0",
        reason: reason.trim(),
        refund: !refundDue ? undefined : method === "CREDIT" ? { method } : { method, accountId, reference: reference || null },
      })
      toast.success(`Return ${saved.code} recorded`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title={`Return items from ${order.code}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={create.isPending} disabled={!ready} onClick={submit}>
            Record return {p ? formatMoney(p.amount) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error ?? (preview.error ? errorMessage(preview.error) : null)} />
        <ul className="divide-y divide-border rounded-xl border border-border">
          {returnable.map((l) => {
            const c = choices[l.id]!
            const left = l.quantity - l.returnedQty
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-48">
                  <p className="text-sm font-medium">
                    {l.productName} — {l.variantName}
                  </p>
                  <p className="text-xs text-faint">
                    <span className="font-mono">{l.sku}</span> · {left} of {l.quantity} returnable · {formatMoney(l.lineTotal)}
                  </p>
                </div>
                <div className="w-20">
                  <Input
                    aria-label={`Return quantity for ${l.sku}`}
                    inputMode="numeric"
                    placeholder="0"
                    value={c.quantity}
                    onChange={(e) => setChoices((s) => ({ ...s, [l.id]: { ...c, quantity: e.target.value.replace(/\D/g, "") } }))}
                    className="py-1.5 text-right"
                  />
                </div>
                <div className="w-56">
                  <Select
                    aria-label={`Condition of ${l.sku}`}
                    value={c.condition}
                    onChange={(e) => setChoices((s) => ({ ...s, [l.id]: { ...c, condition: e.target.value as ReturnCondition } }))}
                    className="py-1.5"
                  >
                    {RETURN_CONDITIONS.map((rc) => (
                      <option key={rc} value={rc}>
                        {RETURN_CONDITION_LABELS[rc]}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Number(order.totals.shippingCharged) > 0 && (
            <Field label="Shipping to refund (₹)" htmlFor="ret-shipping" hint={`Charged ${formatMoney(order.totals.shippingCharged)}`}>
              <Input
                id="ret-shipping"
                inputMode="decimal"
                placeholder="0"
                value={shippingRefund}
                onChange={(e) => setShippingRefund(e.target.value)}
              />
            </Field>
          )}
          <Field label="Reason" htmlFor="ret-reason" required className="sm:col-span-2">
            <Textarea
              id="ret-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong colour, broken on arrival"
            />
          </Field>
        </div>

        {p && (
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Value returned (incl. GST)</span>
              <span className="tabular font-semibold">{formatMoney(p.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Order worth after this</span>
              <span className="tabular">{formatMoney(p.netValueAfter)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Paid so far</span>
              <span className="tabular">{formatMoney(p.paid)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{refundDue ? "To give back" : "Nothing to give back"}</span>
              <span className="tabular">{formatMoney(p.refundDue)}</span>
            </div>
          </div>
        )}

        {refundDue && (
          <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
            {order.customer && (
              <label className="flex items-center gap-2">
                <input type="radio" name="ret-method" checked={method === "CREDIT"} onChange={() => setMethod("CREDIT")} />
                Keep as {order.customer.name}&apos;s credit (for an exchange)
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="ret-method"
                checked={method === "REFUND"}
                disabled={!can("payments.refund")}
                onChange={() => setMethod("REFUND")}
              />
              Refund the money{!can("payments.refund") && " (admin only)"}
            </label>
            {method === "REFUND" && (
              <div className="grid grid-cols-2 gap-2">
                <AccountSelect value={accountId} onChange={setAccountId} placeholder="Refund from…" />
                <Input
                  aria-label="Refund reference"
                  placeholder="Reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
