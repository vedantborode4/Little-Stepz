"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import RequirePermission from "@/components/shell/RequirePermission"
import type { MovementKind } from "@/features/inventory/api"
import MovementForm from "@/features/inventory/MovementForm"

function NewMovement() {
  const type = useSearchParams().get("type") as MovementKind | null
  return <MovementForm initialKind={type ?? undefined} />
}

export default function NewMovementPage() {
  return (
    <RequirePermission permission="inventory.view">
      <Suspense>
        <NewMovement />
      </Suspense>
    </RequirePermission>
  )
}
