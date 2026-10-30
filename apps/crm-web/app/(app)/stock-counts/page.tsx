import RequirePermission from "@/components/shell/RequirePermission"
import StockCountsList from "@/features/stockcounts/StockCountsList"

export default function StockCountsPage() {
  return (
    <RequirePermission permission="stockcount.perform">
      <StockCountsList />
    </RequirePermission>
  )
}
