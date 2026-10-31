import RequirePermission from "@/components/shell/RequirePermission"
import CustomersList from "@/features/customers/CustomersList"

export default function CustomersPage() {
  return (
    <RequirePermission permission="customers.view">
      <CustomersList />
    </RequirePermission>
  )
}
