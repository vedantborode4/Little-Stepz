import AdminSidebar from "./AdminSidebar"
import AdminTopbar from "./AdminTopbar"

export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <AdminSidebar />

      <div className="flex-1 bg-gray-50 min-h-screen">
        <AdminTopbar />
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}