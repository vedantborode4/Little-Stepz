import clsx from "clsx"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

const WINDOW = 5

/** The admin panel's pager (5-page window on desktop, n/N on phones), made shared. */
export default function Pagination({ page, totalPages, total, onPageChange }: Props) {
  if (total === 0) return null
  const start = Math.max(1, Math.min(page - 2, totalPages - WINDOW + 1))
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs sm:text-sm text-muted">
        {total.toLocaleString("en-IN")} {total === 1 ? "record" : "records"}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <PagerButton label="Previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={16} />
          </PagerButton>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={clsx(
                "w-8 h-8 hidden sm:flex items-center justify-center rounded-lg text-sm font-medium transition",
                p === page ? "bg-primary text-white" : "border border-border text-muted hover:bg-surface-2",
              )}
            >
              {p}
            </button>
          ))}
          <span className="sm:hidden text-sm text-muted font-medium px-2">
            {page}/{totalPages}
          </span>
          <PagerButton label="Next page" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={16} />
          </PagerButton>
        </div>
      )}
    </div>
  )
}

function PagerButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
