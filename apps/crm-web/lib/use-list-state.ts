"use client"

import { useCallback, useState } from "react"

export interface ListState<F extends object = Record<string, never>> {
  page: number
  limit: number
  sort?: string
  q?: string
  filters: F
}

/**
 * Table state for server-driven lists. Changing search, sort or a filter resets to
 * page 1, so a narrowed result never opens on an empty page.
 */
export function useListState<F extends object = Record<string, never>>(initial: Partial<ListState<F>> = {}) {
  const [state, setState] = useState<ListState<F>>({
    page: 1,
    limit: 25,
    filters: {} as F,
    ...initial,
  })

  const update = useCallback((patch: Partial<Omit<ListState<F>, "filters">> & { filters?: Partial<F> }) => {
    setState((prev) => ({
      ...prev,
      ...patch,
      filters: patch.filters ? { ...prev.filters, ...patch.filters } : prev.filters,
      page: patch.page ?? 1,
    }))
  }, [])

  /** Flat params for the API: page, limit, sort, q and each filter (empty values dropped). */
  const params = {
    page: state.page,
    limit: state.limit,
    sort: state.sort,
    q: state.q || undefined,
    ...Object.fromEntries(Object.entries(state.filters).filter(([, v]) => v !== undefined && v !== "")),
  }

  return { state, update, params }
}
