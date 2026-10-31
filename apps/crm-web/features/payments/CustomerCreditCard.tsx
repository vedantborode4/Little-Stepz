"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CREDIT_ENTRY_TYPE_LABELS } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useCustomerCredit, useRefundCredit } from "./api"
import { AccountSelect } from "./shared"

function RefundModal({ customerId, balance, onClose }: { customerId: string; balance: string; onClose: () => void }) {
  const refund = useRefundCredit(customerId)
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState(balance)
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Refund customer credit"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!accountId || !amount}
            loading={refund.isPending}
            onClick={async () => {
              setError(null)
              try {
                await refund.mutateAsync({ accountId, amount, reference: reference || null })
                toast.success("Refund recorded")
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Refund {formatMoney(amount || 0)}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <Field label="Paid from" htmlFor="rf-account" required>
          <AccountSelect id="rf-account" value={accountId} onChange={setAccountId} />
        </Field>
        <Field label="Amount (₹)" htmlFor="rf-amount" hint={`Available: ${formatMoney(balance)}`}>
          <Input id="rf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reference" htmlFor="rf-ref">
          <Input id="rf-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** The customer's credit ledger: what's held for them and where it came from or went. */
export default function CustomerCreditCard({ customerId }: { customerId: string }) {
  const can = useCan()
  const { data } = useCustomerCredit(customerId)
  const [refunding, setRefunding] = useState(false)
  if (!data || (data.entries.length === 0 && Number(data.balance) === 0)) return null

  return (
    <Card
      title={`Customer credit · ${formatMoney(data.balance)}`}
      action={
        can("payments.refund") &&
        Number(data.balance) > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setRefunding(true)}>
            Refund
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border -my-2">
        {data.entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{CREDIT_ENTRY_TYPE_LABELS[e.type]}</p>
              <p className="text-xs text-faint">
                {formatDate(e.createdAt)}
                {e.orderCode && ` · ${e.orderCode}`}
                {e.paymentCode && ` · ${e.paymentCode}`}
              </p>
            </div>
            <span className={`tabular font-medium ${Number(e.amount) < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
              {Number(e.amount) > 0 && "+"}
              {formatMoney(e.amount)}
            </span>
          </li>
        ))}
      </ul>
      {refunding && <RefundModal customerId={customerId} balance={data.balance} onClose={() => setRefunding(false)} />}
    </Card>
  )
}
