import RequirePermission from "@/components/shell/RequirePermission"
import { PageHeader } from "@/components/ui/Display"
import PurchaseForm from "@/features/purchases/PurchaseForm"

export default function NewPurchasePage() {
  return (
    <RequirePermission permission="purchases.manage">
      <PageHeader title="New purchase" subtitle="Saved as a draft. Stock is added only when you receive the goods." />
      <PurchaseForm />
    </RequirePermission>
  )
}
