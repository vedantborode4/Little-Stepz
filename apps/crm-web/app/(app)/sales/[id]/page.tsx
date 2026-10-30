import RequirePermission from "@/components/shell/RequirePermission"
import OrderDetail from "@/features/sales/OrderDetail"

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="sales.view">
      <OrderDetail id={id} />
    </RequirePermission>
  )
}
