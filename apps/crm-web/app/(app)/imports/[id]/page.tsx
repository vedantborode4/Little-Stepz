import RequirePermission from "@/components/shell/RequirePermission"
import ImportDetail from "@/features/imports/ImportDetail"

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="import.manage">
      <ImportDetail id={id} />
    </RequirePermission>
  )
}
