import AffiliateSidebar from "./AffiliateSidebar"

export default function AffiliateShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <AffiliateSidebar />

      <div className="flex-1 bg-gray-50 min-h-screen">
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}