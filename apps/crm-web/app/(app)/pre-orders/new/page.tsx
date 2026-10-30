import RequirePermission from "@/components/shell/RequirePermission"
import OrderForm from "@/features/sales/OrderForm"

export default function NewPreOrderPage() {
  return (
    <RequirePermission permission="sales.create">
      <OrderForm type="PRE_ORDER" />
    </RequirePermission>
  )
}
