"use client"

import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"
import LinkTabs from "@/components/ui/Tabs"
import { formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"

const STATUS_TONES: Record<PurchaseStatus, BadgeTone> = { DRAFT: "yellow", RECEIVED: "green", CANCELLED: "gray" }

export const PurchaseStatusBadge = ({ status }: { status: PurchaseStatus }) => (
  <Badge tone={STATUS_TONES[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>
)

/** Amount in a foreign currency, e.g. "CNY 900.00". */
export function foreign(amount: string | number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

export function PurchaseTabs() {
  const can = useCan()
  return (
    <LinkTabs
      tabs={[
        { label: "Purchases", href: "/purchases", exact: true },
        ...(can("products.manage") || can("purchases.manage") ? [{ label: "Suppliers", href: "/purchases/suppliers" }] : []),
      ]}
    />
  )
}

/** "They hold ₹20,420 of ours" / "We owe them ₹8,573.70" / "Settled". */
export function balanceWords(balance: string) {
  const n = Number(balance)
  if (n > 0) return `They hold ${formatMoney(balance)} of ours`
  if (n < 0) return `We owe them ${formatMoney(-n)}`
  return "Settled"
}

export function BalanceBadge({ balance }: { balance: string }) {
  const n = Number(balance)
  if (n === 0) return <span className="text-faint">Settled</span>
  return (
    <span className={n > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
      {n > 0 ? "They hold " : "We owe "}
      <span className="tabular font-semibold">{formatMoney(Math.abs(n))}</span>
    </span>
  )
}
