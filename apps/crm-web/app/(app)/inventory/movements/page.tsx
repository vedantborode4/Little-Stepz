import RequirePermission from "@/components/shell/RequirePermission"
import Movements from "@/features/inventory/Movements"

export default function MovementsPage() {
  return (
    <RequirePermission permission="inventory.view">
      <Movements />
    </RequirePermission>
  )
}
