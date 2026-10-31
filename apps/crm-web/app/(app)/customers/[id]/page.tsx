import RequirePermission from "@/components/shell/RequirePermission"
import CustomerDetail from "@/features/customers/CustomerDetail"

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="customers.view">
      <CustomerDetail id={id} />
    </RequirePermission>
  )
}
