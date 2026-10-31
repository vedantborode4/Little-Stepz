import RequirePermission from "@/components/shell/RequirePermission"
import Valuation from "@/features/analytics/Valuation"

export default function ValuationPage() {
  return (
    <RequirePermission permission="reports.financial">
      <Valuation />
    </RequirePermission>
  )
}
