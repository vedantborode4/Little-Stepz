"use client"

import { Construction } from "lucide-react"
import { usePathname } from "next/navigation"
import { EmptyState, PageHeader } from "@/components/ui/Display"
import { allNavItems, isActivePath } from "@/lib/nav"

/** Placeholder for modules that are planned but not shipped yet. */
export default function UpcomingModulePage() {
  const pathname = usePathname()
  const item = allNavItems.find((i) => i.href !== "/" && isActivePath(pathname, i.href))

  if (!item) {
    return <EmptyState title="Page not found" hint="Check the address or use the menu." />
  }

  return (
    <div>
      <PageHeader title={item.label} />
      <div className="bg-surface border border-border rounded-2xl">
        <EmptyState
          icon={<Construction size={22} />}
          title={`${item.label} arrives in phase ${item.phase}`}
          hint="This module is part of the CRM plan and is not built yet. Nothing here is connected to live data."
        />
      </div>
    </div>
  )
}
