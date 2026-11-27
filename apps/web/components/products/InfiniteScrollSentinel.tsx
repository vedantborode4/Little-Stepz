"use client"

import { useEffect, useRef } from "react"

interface Props {
  hasMore: boolean
  loadingMore: boolean
  error: boolean
  onLoadMore: () => void
  onRetry: () => void
  /** Products shown so far, for the end-of-list note. */
  shown: number
  noun?: string
  /** Grid classes of the list above, so the loading row lines up with it. */
  gridClassName?: string
  placeholders?: number
}

/**
 * Sits under a product grid and asks for the next page shortly before the shopper
 * reaches it. Re-arms after every load, so a tall screen keeps filling until it
 * overflows or the list ends.
 */
export default function InfiniteScrollSentinel({
  hasMore,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
  shown,
  noun = "products",
  gridClassName = "grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6",
  placeholders = 3,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || loadingMore || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMoreRef.current()
      },
      { rootMargin: "0px 0px 800px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, error, shown])

  return (
    <div ref={ref} className="mt-6 sm:mt-8">
      {loadingMore && (
        <div className={gridClassName} aria-label={`Loading more ${noun}`}>
          {Array.from({ length: placeholders }).map((_, i) => (
            <div key={i} className="bg-surface-2 animate-pulse h-[300px] rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-muted">Couldn&apos;t load more {noun}.</p>
          <button
            onClick={onRetry}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-2 transition"
          >
            Try again
          </button>
        </div>
      )}

      {!hasMore && !loadingMore && !error && shown > 0 && (
        <p className="text-center text-xs sm:text-sm text-faint py-4">
          You&apos;ve seen all {shown} {shown === 1 ? noun.replace(/s$/, "") : noun}
        </p>
      )}
    </div>
  )
}
