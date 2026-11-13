"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import RequirePermission from "@/components/shell/RequirePermission"
import Dashboard from "@/features/analytics/Dashboard"
import { allNavItems } from "@/lib/nav"
import { useCan } from "@/store/auth.store"

/** Roles without the dashboard start on their first page instead (cashier → POS, ops → sales orders). */
export default function DashboardPage() {
  const can = useCan()
  const router = useRouter()
  const home = can("dashboard.view") ? null : allNavItems.find((item) => can(item.permission))?.href
  useEffect(() => {
    if (home) router.replace(home)
  }, [home, router])

  if (home) return null
  return (
    <RequirePermission permission="dashboard.view">
      <Dashboard />
    </RequirePermission>
  )
}
