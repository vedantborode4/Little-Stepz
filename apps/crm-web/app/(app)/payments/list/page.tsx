import RequirePermission from "@/components/shell/RequirePermission"
import PaymentsList from "@/features/payments/PaymentsList"

export default function PaymentsListPage() {
  return (
    <RequirePermission permission="payments.view">
      <PaymentsList />
    </RequirePermission>
  )
}
