const statusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-50 text-yellow-600 border border-yellow-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-600 border border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-500 border border-red-200" },
  Done: { label: "Done", className: "bg-blue-50 text-blue-600 border border-blue-200" },
}

export default function AffiliateStatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, className: "bg-gray-100 text-gray-600 border border-gray-200" }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}
