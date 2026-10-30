import RequirePermission from "@/components/shell/RequirePermission"
import Collections from "@/features/payments/Collections"

export default function CollectionsPage() {
  return (
    <RequirePermission permission="payments.view">
      <Collections />
    </RequirePermission>
  )
}
