"use client"

import { Plus, Wallet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PAYMENT_METHOD_LABELS, type SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney, todayIST } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useApplyCredit, useCustomerCredit, useReceivePayment } from "./api"
import { AccountSelect, PaymentStatusBadge } from "./shared"

function RecordPaymentModal({ order, onClose }: { order: SalesOrderDetailDto; onClose: () => void }) {
  const receive = useReceivePayment()
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState(order.due)
  const [reference, setReference] = useState("")
  const [businessDate, setBusinessDate] = useState(todayIST())
  const [keepExcess, setKeepExcess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const excess = Math.round(Number(amount || 0) * 100) - Math.round(Number(order.due) * 100)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const applied = excess > 0 ? order.due : amount
      await receive.mutateAsync({
        customerId: order.customer?.id ?? null,
        accountId,
        amount,
        reference: reference || null,
        businessDate,
        allocations: Number(applied) > 0 ? [{ orderId: order.id, amount: applied }] : [],
        excessToCredit: keepExcess,
      })
      toast.success("Payment recorded")
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title={`Payment for ${order.code}`}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pay-form" loading={receive.isPending} disabled={!accountId || (excess > 0 && !keepExcess)}>
            Record {formatMoney(amount || 0)}
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <p className="text-sm text-muted">
          {formatMoney(order.due)} due of {formatMoney(order.grandTotal)}.
        </p>
        <Field label="Received into" htmlFor="pay-account" required>
          <AccountSelect id="pay-account" value={accountId} onChange={setAccountId} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" htmlFor="pay-amount" required>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="pay-date">
            <Input id="pay-date" type="date" max={todayIST()} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Reference" htmlFor="pay-ref" hint="UPI ref, UTR or cheque no.">
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        {excess > 0 &&
          (order.customer ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={keepExcess} onChange={(e) => setKeepExcess(e.target.checked)} />
              <span>
                Keep the extra {formatMoney(excess / 100)} as {order.customer.name}&apos;s credit
              </span>
            </label>
          ) : (
            <p className="text-xs text-red-500">That&apos;s more than what&apos;s due. Enter what was kept.</p>
          ))}
      </form>
    </Modal>
  )
}

function ApplyCreditModal({ order, available, onClose }: { order: SalesOrderDetailDto; available: string; onClose: () => void }) {
  const apply = useApplyCredit(order.customer!.id)
  const max = Math.min(Number(available), Number(order.due))
  const [amount, setAmount] = useState(max.toFixed(2))
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Use customer credit"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={apply.isPending}
            onClick={async () => {
              setError(null)
              try {
                await apply.mutateAsync({ orderId: order.id, amount })
                toast.success("Credit applied")
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Apply {formatMoney(amount || 0)}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <p className="text-sm text-muted">
          {order.customer!.name} has {formatMoney(available)} of credit; {formatMoney(order.due)} is due on this order.
        </p>
        <Field label="Amount (₹)" htmlFor="credit-amount">
          <Input id="credit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** Payment status and every rupee applied to (or given back from) the order. */
export default function OrderPaymentsCard({ order }: { order: SalesOrderDetailDto }) {
  const can = useCan()
  const credit = useCustomerCredit(can("payments.view") ? order.customer?.id : null)
  const [dialog, setDialog] = useState<"pay" | "credit" | null>(null)
  const payable = order.status !== "DRAFT" && order.status !== "CANCELLED" && Number(order.due) > 0
  const creditAvailable = Number(credit.data?.balance ?? 0) > 0

  return (
    <Card title="Payments" action={order.status !== "DRAFT" ? <PaymentStatusBadge status={order.paymentStatus} /> : undefined}>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Paid</dt>
          <dd className="tabular">{formatMoney(order.paid)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Due</dt>
          <dd className="tabular">{formatMoney(order.due)}</dd>
        </div>
      </dl>
      {order.payments.length > 0 && (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {order.payments.map((p) => (
            <li key={p.id} className="py-2 text-sm flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {p.source === "CREDIT" ? "Customer credit" : `${p.accountName} · ${p.method ? PAYMENT_METHOD_LABELS[p.method] : ""}`}
                </p>
                <p className="text-xs text-faint">
                  {p.code && <span className="font-mono">{p.code} · </span>}
                  {formatDate(p.businessDate)}
                  {p.reference && ` · ${p.reference}`}
                </p>
              </div>
              <span className={`tabular font-medium ${Number(p.amount) < 0 ? "text-red-500" : ""}`}>{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {payable && can("payments.record") && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDialog("pay")}>
            Record payment
          </Button>
          {order.customer && creditAvailable && (
            <Button size="sm" variant="secondary" icon={<Wallet size={14} />} onClick={() => setDialog("credit")}>
              Use credit ({formatMoney(credit.data!.balance)})
            </Button>
          )}
        </div>
      )}
      {dialog === "pay" && <RecordPaymentModal order={order} onClose={() => setDialog(null)} />}
      {dialog === "credit" && credit.data && (
        <ApplyCreditModal order={order} available={credit.data.balance} onClose={() => setDialog(null)} />
      )}
    </Card>
  )
}
