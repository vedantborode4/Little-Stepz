import RequirePermission from "@/components/shell/RequirePermission"
import PreOrdersBoard from "@/features/sales/PreOrdersBoard"

export default function PreOrdersPage() {
  return (
    <RequirePermission permission="sales.view">
      <PreOrdersBoard />
    </RequirePermission>
  )
}
