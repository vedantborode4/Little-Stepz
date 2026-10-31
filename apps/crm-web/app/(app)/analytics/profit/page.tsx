import RequirePermission from "@/components/shell/RequirePermission"
import ProfitAnalytics from "@/features/analytics/ProfitAnalytics"

export default function ProfitPage() {
  return (
    <RequirePermission permission="reports.financial">
      <ProfitAnalytics />
    </RequirePermission>
  )
}
