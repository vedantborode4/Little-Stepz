import RequirePermission from "@/components/shell/RequirePermission"
import AuditExplorer from "@/features/audit/AuditExplorer"

export default function AuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditExplorer />
    </RequirePermission>
  )
}
