"use client"

import { use } from "react"
import RequirePermission from "@/components/shell/RequirePermission"
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { usePurchase } from "@/features/purchases/api"
import PurchaseForm from "@/features/purchases/PurchaseForm"

function EditPurchase({ id }: { id: string }) {
  const { data, isLoading } = usePurchase(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Purchase not found" />
  if (data.status !== "DRAFT")
    return (
      <EmptyState
        title={`${data.code} is ${data.status.toLowerCase()}`}
        hint="Only drafts can be edited. Use a late charge or a return instead."
      />
    )
  return (
    <>
      <PageHeader title={`Edit ${data.code}`} subtitle="Still a draft — nothing has been added to stock." />
      <PurchaseForm purchase={data} />
    </>
  )
}

export default function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequirePermission permission="purchases.manage">
      <EditPurchase id={id} />
    </RequirePermission>
  )
}
