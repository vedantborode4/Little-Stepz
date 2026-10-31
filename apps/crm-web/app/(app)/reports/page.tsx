import RequirePermission from "@/components/shell/RequirePermission"
import Reports from "@/features/analytics/Reports"

export default function ReportsPage() {
  return (
    <RequirePermission permission="reports.view">
      <Reports />
    </RequirePermission>
  )
}
