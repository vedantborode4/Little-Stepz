"use client"

import { Lock } from "lucide-react"
import type { Permission } from "@repo/crm-schema"
import { EmptyState } from "@/components/ui/Display"
import { useCan } from "@/store/auth.store"

/** Page-level guard; the API rejects the same requests, this just explains why. */
export default function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const can = useCan()
  if (!can(permission)) {
    return (
      <div className="bg-surface border border-border rounded-2xl">
        <EmptyState icon={<Lock size={22} />} title="You don't have access to this page" hint="Ask an admin if you need it." />
      </div>
    )
  }
  return <>{children}</>
}
