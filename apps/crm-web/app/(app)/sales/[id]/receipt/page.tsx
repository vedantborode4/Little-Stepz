import RequirePermission from "@/components/shell/RequirePermission"
import Receipt from "@/features/sales/Receipt"

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="sales.view">
      <Receipt id={id} />
    </RequirePermission>
  )
}
