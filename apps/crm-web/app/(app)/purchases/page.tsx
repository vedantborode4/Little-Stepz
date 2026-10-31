import RequirePermission from "@/components/shell/RequirePermission"
import PurchasesList from "@/features/purchases/PurchasesList"

export default function PurchasesPage() {
  return (
    <RequirePermission permission="purchases.view">
      <PurchasesList />
    </RequirePermission>
  )
}
