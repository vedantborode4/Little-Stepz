import RequirePermission from "@/components/shell/RequirePermission"
import OrderForm from "@/features/sales/OrderForm"

export default function NewOrderPage() {
  return (
    <RequirePermission permission="sales.create">
      <OrderForm />
    </RequirePermission>
  )
}
