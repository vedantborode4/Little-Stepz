import RequirePermission from "@/components/shell/RequirePermission"
import Advances from "@/features/payments/Advances"

export default function AdvancesPage() {
  return (
    <RequirePermission permission="payments.view">
      <Advances />
    </RequirePermission>
  )
}
