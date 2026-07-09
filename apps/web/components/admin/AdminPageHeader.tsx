"use client"

interface Props {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function AdminPageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-text truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
