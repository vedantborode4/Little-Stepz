"use client"

import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"
import LinkTabs from "@/components/ui/Tabs"
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
