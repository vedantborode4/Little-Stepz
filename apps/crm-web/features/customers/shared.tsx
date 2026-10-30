"use client"

import { CUSTOMER_TYPE_LABELS, type CustomerType } from "@repo/crm-schema"
import { Badge } from "@/components/ui/Display"
import LinkTabs from "@/components/ui/Tabs"
import { useCan } from "@/store/auth.store"

export const CustomerTypeBadge = ({ type }: { type: CustomerType }) => (
  <Badge tone={type === "WHOLESALE" ? "purple" : "blue"}>{CUSTOMER_TYPE_LABELS[type]}</Badge>
)

export function creditTerms(c: { creditDays: number | null; creditLimit: string | null }, format: (v: string) => string) {
  if (c.creditDays === null && c.creditLimit === null) return null
  return [c.creditDays !== null && `${c.creditDays} days`, c.creditLimit !== null && `limit ${format(c.creditLimit)}`]
    .filter(Boolean)
    .join(" · ")
}

export function CustomerTabs() {
  const can = useCan()
  return (
    <LinkTabs
      tabs={[
        { label: "Customers", href: "/customers", exact: true },
        ...(can("customers.merge") ? [{ label: "Possible duplicates", href: "/customers/duplicates" }] : []),
      ]}
    />
  )
}
