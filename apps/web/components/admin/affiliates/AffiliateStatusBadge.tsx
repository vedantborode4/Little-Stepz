const statusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30" },
  APPROVED: { label: "Approved", className: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30" },
  REJECTED: { label: "Rejected", className: "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30" },
  Done: { label: "Done", className: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30" },
}

export default function AffiliateStatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, className: "bg-surface-2 text-muted border border-border" }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}
