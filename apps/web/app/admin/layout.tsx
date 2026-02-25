import AdminGuard from "../../components/admin/AdminGuard"
import AdminShell from "../../components/admin/AdminShell"

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  )
}