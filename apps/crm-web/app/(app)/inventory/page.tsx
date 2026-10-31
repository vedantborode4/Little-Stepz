import RequirePermission from "@/components/shell/RequirePermission"
import StockLevels from "@/features/inventory/StockLevels"

export default function InventoryPage() {
  return (
    <RequirePermission permission="inventory.view">
      <StockLevels />
    </RequirePermission>
  )
}
