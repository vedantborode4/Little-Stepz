import RequirePermission from "@/components/shell/RequirePermission"
import Transfers from "@/features/payments/Transfers"

export default function TransfersPage() {
  return (
    <RequirePermission permission="payments.transfer">
      <Transfers />
    </RequirePermission>
  )
}
