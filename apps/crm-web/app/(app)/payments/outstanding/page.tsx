import RequirePermission from "@/components/shell/RequirePermission"
import Outstanding from "@/features/payments/Outstanding"

export default function OutstandingPage() {
  return (
    <RequirePermission permission="payments.view">
      <Outstanding />
    </RequirePermission>
  )
}
