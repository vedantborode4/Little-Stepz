"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHODS,
  CHARGE_TYPE_LABELS,
  CHARGE_TYPES,
  lateChargeSchema,
  purchaseReturnSchema,
  RECOVERABLE_BY_DEFAULT,
  STOCK_BUCKET_LABELS,
  STOCK_BUCKETS,
  type AllocationMethod,
  type ChargeType,
  type PurchaseDetailDto,
  type StockBucket,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatMoney, todayIST } from "@/lib/format"
import { apiErrorsToMap, issuesToErrors, type ErrorMap } from "@/lib/validation"
import { useLocations } from "../settings/api"
import { useCancelPurchase, useLateCharge, useReceivePurchase, useReturnToSupplier } from "./api"

export function ReceiveDialog({ purchase, onClose }: { purchase: PurchaseDetailDto; onClose: () => void }) {
  const receive = useReceivePurchase(purchase.id)
  const [businessDate, setBusinessDate] = useState(todayIST())
  const units = purchase.lines.reduce((a, l) => a + l.quantity, 0)

  const onConfirm = async () => {
    try {
      await receive.mutateAsync({ businessDate })
      toast.success(`${purchase.code} received — ${units} units added to ${purchase.location.name}`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <ConfirmDialog
      title={`Receive ${purchase.code}?`}
      tone="primary"
      confirmLabel="Receive goods"
      loading={receive.isPending}
      onCancel={onClose}
      onConfirm={onConfirm}
      message={
        <div className="space-y-3">
          <p>
            {units} units go into <strong>{purchase.location.name}</strong> as sellable stock
            {purchase.totals ? (
              <>
                {" "}
                at a landed total of <strong>{formatMoney(purchase.totals.landedTotal)}</strong>
              </>
            ) : null}
            .
          </p>
          <p>Prices, rate and charges are then locked. Later corrections are cost adjustments or returns.</p>
          <Field label="Received on" htmlFor="recv-date">
            <Input id="recv-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
        </div>
      }
    />
  )
}

export function CancelDialog({ purchase, onClose }: { purchase: PurchaseDetailDto; onClose: () => void }) {
  const cancel = useCancelPurchase(purchase.id)
  return (
    <ConfirmDialog
      title={`Cancel ${purchase.code}?`}
      confirmLabel="Cancel purchase"
      loading={cancel.isPending}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await cancel.mutateAsync(undefined)
          toast.success(`${purchase.code} cancelled`)
          onClose()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
      message="The draft is kept for the record but can't be received or edited any more. No stock was added."
    />
  )
}

export function LateChargeModal({ purchase, onClose }: { purchase: PurchaseDetailDto; onClose: () => void }) {
  const add = useLateCharge(purchase.id)
  const [form, setForm] = useState({
    type: "CLEARING" as ChargeType,
    description: "",
    amountInr: "",
    isRecoverableTax: false,
    allocationMethod: purchase.allocationMethod as AllocationMethod,
  })
  const [errors, setErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    const parsed = lateChargeSchema.safeParse(form)
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues))
    try {
      await add.mutateAsync(parsed.data)
      toast.success("Late charge recorded")
      onClose()
    } catch (err) {
      setFormError(errorMessage(err))
      setErrors(apiErrorsToMap(err))
    }
  }

  return (
    <Modal
      title={`Late charge — ${purchase.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={add.isPending} onClick={submit}>
            Record charge
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={formError} />
        <p className="text-sm text-muted">
          For a bill that arrived after the goods. The share for units still in stock raises their cost; the share for units already gone is
          counted as cost of sales. Past purchase prices are not changed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="lc-type">
            <Select
              id="lc-type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
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
          </Field>
          <Field label="Amount ₹" htmlFor="lc-amount" required error={errors.amountInr}>
            <Input
              id="lc-amount"
              inputMode="decimal"
              value={form.amountInr}
              onChange={(e) => setForm({ ...form, amountInr: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="lc-desc">
          <Input id="lc-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Split across items" htmlFor="lc-method">
          <Select
            id="lc-method"
            value={form.allocationMethod}
            onChange={(e) => setForm({ ...form, allocationMethod: e.target.value as AllocationMethod })}
          >
            {ALLOCATION_METHODS.map((m) => (
              <option key={m} value={m}>
                {ALLOCATION_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          id="lc-recoverable"
          label="Recoverable tax (input credit)"
          description="Recorded as input tax credit only — it doesn't change stock cost."
          checked={form.isRecoverableTax}
          onChange={(e) => setForm({ ...form, isRecoverableTax: e.target.checked })}
        />
      </div>
    </Modal>
  )
}

export function ReturnModal({ purchase, onClose }: { purchase: PurchaseDetailDto; onClose: () => void }) {
  const returnGoods = useReturnToSupplier(purchase.id)
  const locations = useLocations()
  const [locationId, setLocationId] = useState(purchase.location.id)
  const [bucket, setBucket] = useState<StockBucket>("SELLABLE")
  const [reason, setReason] = useState("")
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)
  const returnable = purchase.lines.filter((l) => l.quantity > l.returnedQty)

  const submit = async () => {
    const lines = returnable.filter((l) => Number(quantities[l.id]) > 0).map((l) => ({ purchaseLineId: l.id, quantity: quantities[l.id] }))
    const parsed = purchaseReturnSchema.safeParse({ locationId, bucket, reason, lines })
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues))
    try {
      await returnGoods.mutateAsync(parsed.data)
      toast.success("Return recorded")
      onClose()
    } catch (err) {
      setFormError(errorMessage(err))
      setErrors(apiErrorsToMap(err))
    }
  }

  return (
    <Modal
      title={`Return to ${purchase.supplier.name}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={returnGoods.isPending} onClick={submit}>
            Record return
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={formError} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taken from" htmlFor="rt-loc" error={errors.locationId}>
            <Select id="rt-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stock status" htmlFor="rt-bucket">
            <Select id="rt-bucket" value={bucket} onChange={(e) => setBucket(e.target.value as StockBucket)}>
              {STOCK_BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {STOCK_BUCKET_LABELS[b]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Reason" htmlFor="rt-reason" required error={errors.reason}>
          <Input id="rt-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Faulty batch" />
        </Field>
        {errors.lines && <p className="text-xs text-red-500">{errors.lines}</p>}
        <ul className="divide-y divide-border">
          {returnable.map((l, i) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {l.productName} — {l.variantName}
                </p>
                <p className="text-xs text-muted">
                  Received {l.quantity}
                  {l.returnedQty ? `, already returned ${l.returnedQty}` : ""}
                </p>
              </div>
              <div className="w-24">
                <Input
                  aria-label={`Return quantity for ${l.sku}`}
                  inputMode="numeric"
                  placeholder={`max ${l.quantity - l.returnedQty}`}
                  value={quantities[l.id] ?? ""}
                  onChange={(e) => setQuantities({ ...quantities, [l.id]: e.target.value })}
                />
                {errors[`lines.${i}.quantity`] && <p className="text-[11px] text-red-500 mt-1">{errors[`lines.${i}.quantity`]}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
