import RequirePermission from "@/components/shell/RequirePermission"
import SalesList from "@/features/sales/SalesList"

export default function SalesPage() {
  return (
    <RequirePermission permission="sales.view">
      <SalesList />
    </RequirePermission>
  )
}
