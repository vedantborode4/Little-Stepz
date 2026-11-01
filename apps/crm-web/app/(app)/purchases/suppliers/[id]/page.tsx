import RequirePermission from "@/components/shell/RequirePermission"
import SupplierDetail from "@/features/purchases/SupplierDetail"

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="purchases.manage">
      <SupplierDetail id={id} />
    </RequirePermission>
  )
}
