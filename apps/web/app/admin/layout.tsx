import { Toaster } from "sonner"
import AdminGuard from "../../components/admin/AdminGuard"
import AdminShell from "../../components/admin/AdminShell"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
      <Toaster position="top-right" richColors />
    </AdminGuard>
  )
}
