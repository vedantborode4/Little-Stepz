"use client"

import LinkTabs from "@/components/ui/Tabs"
import { useCan } from "@/store/auth.store"

export default function CatalogTabs() {
  const can = useCan()
  const tabs = [
    { label: "Products", href: "/products", exact: true },
    { label: "Categories", href: "/products/categories" },
    { label: "Brands", href: "/products/brands" },
    ...(can("products.manage") ? [{ label: "Bulk price edit", href: "/products/bulk-price" }] : []),
  ]
  return <LinkTabs tabs={tabs} />
}
