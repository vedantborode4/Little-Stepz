"use client"

import clsx from "clsx"
import { Trash2 } from "lucide-react"
import { PAYMENT_METHOD_LABELS } from "@repo/crm-schema"
import { Checkbox, Input } from "@/components/ui/Form"
import { formatMoney } from "@/lib/format"
import { uuid } from "@/lib/uuid"
import { useReceivingAccounts } from "../settings/api"

export interface TenderLine {
  key: string
  accountId: string
  amount: string
  reference: string
}

const paise = (v: string | number) => Math.round(Number(v || 0) * 100)

/** Remaining due in paise (negative = more tendered than the total). */
export function tenderBalance(total: string, tenders: TenderLine[]) {
  return paise(total) - tenders.reduce((s, t) => s + paise(t.amount), 0)
}

interface Props {
  total: string
  tenders: TenderLine[]
  onChange: (tenders: TenderLine[]) => void
  hasCustomer: boolean
  excessToCredit: boolean
  onExcessToCredit: (value: boolean) => void
}

/**
 * Split payment at the till: tap an account to add the remaining amount to it,
 * adjust amounts, and add a reference for UPI or card. What's entered is what
 * was kept — change handed back isn't recorded.
 */
export default function TenderEditor({ total, tenders, onChange, hasCustomer, excessToCredit, onExcessToCredit }: Props) {
  const accounts = useReceivingAccounts()
  const active = accounts.data?.filter((a) => a.isActive) ?? []
  const balance = tenderBalance(total, tenders)

  const add = (accountId: string) =>
    onChange([...tenders, { key: uuid(), accountId, amount: balance > 0 ? (balance / 100).toFixed(2) : "", reference: "" }])
  const update = (key: string, patch: Partial<TenderLine>) => onChange(tenders.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {active.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => add(a.id)}
            className="px-3 py-2 rounded-xl border border-border text-sm hover:border-primary hover:text-primary transition"
          >
            {a.name}
          </button>
        ))}
      </div>

      {tenders.length > 0 && (
        <ul className="space-y-2">
          {tenders.map((t) => {
            const account = active.find((a) => a.id === t.accountId)
            return (
              <li key={t.key} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account?.name ?? "Account"}</p>
                  <p className="text-xs text-faint">{account ? PAYMENT_METHOD_LABELS[account.method] : ""}</p>
                </div>
                {account?.method !== "CASH" && (
                  <div className="w-28">
                    <Input
                      aria-label={`Reference for ${account?.name}`}
                      placeholder="Ref / UTR"
                      value={t.reference}
                      onChange={(e) => update(t.key, { reference: e.target.value })}
                      className="py-1.5"
                    />
                  </div>
                )}
                <div className="w-28">
                  <Input
                    aria-label={`Amount for ${account?.name}`}
                    inputMode="decimal"
                    value={t.amount}
                    onChange={(e) => update(t.key, { amount: e.target.value })}
                    className="py-1.5 text-right tabular"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${account?.name}`}
                  className="p-2 rounded-lg text-faint hover:text-red-500"
                  onClick={() => onChange(tenders.filter((x) => x.key !== t.key))}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div
        className={clsx(
          "flex justify-between rounded-xl px-3 py-2 text-sm font-medium",
          balance === 0 ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-surface-2",
        )}
      >
        <span>{balance > 0 ? "Still to pay" : balance < 0 ? "More than the total" : "Fully paid"}</span>
        <span className="tabular">{formatMoney(Math.abs(balance) / 100)}</span>
      </div>
      {balance > 0 && !hasCustomer && tenders.length > 0 && <p className="text-xs text-red-500">Walk-in sales must be paid in full.</p>}
      {balance > 0 && hasCustomer && <p className="text-xs text-muted">The rest stays on the customer&apos;s account as due.</p>}
      {balance < 0 &&
        (hasCustomer ? (
          <Checkbox
            id="excess-credit"
            label={`Keep ${formatMoney(-balance / 100)} as the customer's credit`}
            checked={excessToCredit}
            onChange={(e) => onExcessToCredit(e.target.checked)}
          />
        ) : (
          <p className="text-xs text-red-500">Enter what was kept, not the cash handed over. Change isn&apos;t recorded.</p>
        ))}
    </div>
  )
}
