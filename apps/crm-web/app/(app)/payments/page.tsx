import RequirePermission from "@/components/shell/RequirePermission"
import PaymentsList from "@/features/payments/PaymentsList"

export default function PaymentsPage() {
  return (
    <RequirePermission permission="payments.view">
      <PaymentsList />
    </RequirePermission>
  )
}
