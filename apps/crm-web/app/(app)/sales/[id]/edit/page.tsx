import RequirePermission from "@/components/shell/RequirePermission"
import EditOrder from "@/features/sales/EditOrder"

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="sales.create">
      <EditOrder id={id} />
    </RequirePermission>
  )
}
