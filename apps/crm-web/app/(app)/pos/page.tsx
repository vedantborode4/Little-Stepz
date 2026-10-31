import RequirePermission from "@/components/shell/RequirePermission"
import PosScreen from "@/features/sales/PosScreen"

export default function PosPage() {
  return (
    <RequirePermission permission="sales.create">
      <PosScreen />
    </RequirePermission>
  )
}
