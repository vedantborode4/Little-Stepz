import clsx from "clsx"

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-text truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

export function Card({ title, action, className, children }: { title?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("bg-surface border border-border rounded-2xl", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

interface StatCardProps {
  title: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  color?: string
}

/** KPI tile in the admin dashboard's StatCard style. */
export function StatCard({ title, value, hint, icon, color = "bg-primary/10 text-primary" }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3 gap-2">
        <p className="text-sm text-muted font-medium">{title}</p>
        {icon && <div className={`p-2 rounded-xl ${color}`}>{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-text tabular">{value}</div>
      {hint && <p className="text-xs text-faint mt-1.5">{hint}</p>}
    </div>
  )
}

export type BadgeTone = "green" | "red" | "yellow" | "blue" | "purple" | "gray"

const tones: Record<BadgeTone, string> = {
  green: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  red: "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400",
  yellow: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  purple: "bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400",
  gray: "bg-surface-2 text-muted",
}

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {icon && <div className="w-12 h-12 rounded-2xl bg-surface-2 text-faint flex items-center justify-center mb-3">{icon}</div>}
      <p className="text-sm font-semibold text-text">{title}</p>
      {hint && <p className="text-xs text-muted mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("bg-surface-2 rounded animate-pulse", className)} />
}

/** Definition list for detail panels: label left, value right. */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm text-text text-right font-medium">{children}</dd>
    </div>
  )
}
