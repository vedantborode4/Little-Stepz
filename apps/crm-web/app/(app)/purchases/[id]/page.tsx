import RequirePermission from "@/components/shell/RequirePermission"
import PurchaseDetail from "@/features/purchases/PurchaseDetail"

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="purchases.view">
      <PurchaseDetail id={id} />
    </RequirePermission>
  )
}
