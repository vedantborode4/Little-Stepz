import RequirePermission from "@/components/shell/RequirePermission"
import SuppliersPanel from "@/features/purchases/SuppliersPanel"

export default function SuppliersPage() {
  return (
    <RequirePermission permission="purchases.manage">
      <SuppliersPanel />
    </RequirePermission>
  )
}
