"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { PaginatedProducts } from "../lib/services/product.service"
import type { Product } from "../types/product"

interface ListState {
  key: string
  products: Product[]
  /** Last page loaded; 0 while the first page is on its way. */
  page: number
  totalPages: number
  total: number
}

interface Snapshot extends ListState {
  scrollY: number
  savedAt: number
  /** History entry the snapshot was taken on; Back returns to the same entry. */
  entryKey: string | null
}

interface Options {
  /** Identity of the list (path + filters). A new key restarts the list from the top. */
  key: string
  fetchPage: (page: number) => Promise<PaginatedProducts>
  /** Page 1 rendered on the server, valid for `initialKey`. */
  initial?: { key: string; products: Product[]; totalPages: number; total?: number }
  /** Hold off until the caller has settled its filters (e.g. read them from the URL). */
  enabled?: boolean
  /**
   * Top of the results. When the filters change while the shopper is scrolled past it,
   * the page jumps back here; otherwise the new list would start out of view (and the
   * old scroll depth would immediately pull in a second batch).
   */
  scrollTargetRef?: RefObject<HTMLElement | null>
}

const SNAPSHOT_PREFIX = "infinite-list:"
const SNAPSHOT_TTL_MS = 30 * 60 * 1000

/**
 * The current history entry's key (Navigation API). Going Back returns to the same
 * entry and key, while following a link to the list creates a new one, so this tells
 * "came back" (restore where the shopper was) from a fresh visit (start at the top).
 */
function currentEntryKey(): string | null {
  try {
    const nav = (window as Window & { navigation?: { currentEntry?: { key: string } | null } }).navigation
    return nav?.currentEntry?.key ?? null
  } catch {
    return null
  }
}

// Fallback for browsers without the Navigation API: remember when back/forward happened.
// Capture phase, so it runs before Next's own popstate listener renders the page.
let lastPopStateAt = 0
if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    () => {
      lastPopStateAt = Date.now()
    },
    { capture: true },
  )
}

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_PREFIX + key)
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    return Date.now() - snap.savedAt < SNAPSHOT_TTL_MS && snap.products.length ? snap : null
  } catch {
    return null
  }
}

function writeSnapshot(state: ListState) {
  try {
    const snap: Snapshot = { ...state, scrollY: window.scrollY, savedAt: Date.now(), entryKey: currentEntryKey() }
    sessionStorage.setItem(SNAPSHOT_PREFIX + state.key, JSON.stringify(snap))
  } catch {
    // Storage full or blocked: the list still works, Back just starts at the top.
  }
}

function mergeUnique(current: Product[], next: Product[]) {
  const seen = new Set(current.map((p) => p.id))
  return [...current, ...next.filter((p) => !seen.has(p.id))]
}

/**
 * A product list that grows as the shopper scrolls. Loads one page at a time,
 * never the same page twice, ignores answers for filters that have since changed,
 * and restores the loaded list and scroll position when the shopper comes Back.
 */
export function useInfiniteProducts({ key, fetchPage, initial, enabled = true, scrollTargetRef }: Options) {
  const fromServer = (k: string): ListState | null =>
    initial && initial.key === k
      ? {
          key: k,
          products: initial.products,
          page: 1,
          totalPages: initial.totalPages,
          total: initial.total ?? initial.products.length,
        }
      : null

  const [state, setState] = useState<ListState>(
    () => fromServer(key) ?? { key, products: [], page: 0, totalPages: 1, total: 0 },
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const inFlight = useRef<string | null>(null)
  const startedKey = useRef<string | null>(null)
  const pendingScroll = useRef<number | null>(null)
  const poppedRecently = useRef(Date.now() - lastPopStateAt < 3000)
  // Only the first list shown after mounting may be restored; later filter changes start fresh.
  const firstStart = useRef(true)

  const load = useCallback(async (listKey: string, page: number) => {
    const request = `${listKey}#${page}`
    if (inFlight.current === request) return
    inFlight.current = request
    setLoadingMore(true)
    setError(false)
    try {
      const res = await fetchRef.current(page)
      if (stateRef.current.key !== listKey) return
      setState((s) => ({
        key: listKey,
        products: page === 1 ? res.data : mergeUnique(s.products, res.data),
        page,
        totalPages: res.meta.totalPages,
        total: res.meta.total,
      }))
    } catch {
      if (stateRef.current.key === listKey) setError(true)
    } finally {
      if (inFlight.current === request) {
        inFlight.current = null
        setLoadingMore(false)
      }
    }
  }, [])

  // Start (or restart) the list whenever its identity changes.
  useEffect(() => {
    if (!enabled || startedKey.current === key) return
    startedKey.current = key
    setError(false)

    const isFirst = firstStart.current
    firstStart.current = false
    const target = scrollTargetRef?.current
    if (!isFirst && target && target.getBoundingClientRect().top < 0) target.scrollIntoView({ block: "start" })

    const saved = isFirst ? readSnapshot(key) : null
    const entry = currentEntryKey()
    const snapshot =
      saved && (entry && saved.entryKey ? saved.entryKey === entry : poppedRecently.current) ? saved : null
    if (snapshot) {
      pendingScroll.current = snapshot.scrollY
      setState({
        key,
        products: snapshot.products,
        page: snapshot.page,
        totalPages: snapshot.totalPages,
        total: snapshot.total,
      })
      return
    }

    const server = fromServer(key)
    if (server) {
      setState(server)
      return
    }
    setState({ key, products: [], page: 0, totalPages: 1, total: 0 })
    stateRef.current = { key, products: [], page: 0, totalPages: 1, total: 0 }
    void load(key, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, load])

  // After a restore has rendered, put the shopper back where they were.
  useLayoutEffect(() => {
    if (pendingScroll.current === null) return
    const y = pendingScroll.current
    pendingScroll.current = null
    requestAnimationFrame(() => window.scrollTo(0, y))
  }, [state])

  // Keep a snapshot of the loaded list and the scroll position for the Back button.
  useEffect(() => {
    if (!enabled || state.page === 0) return
    writeSnapshot(state)
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => writeSnapshot(stateRef.current), 150)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [state, enabled])

  const hasMore = state.page > 0 && state.page < state.totalPages

  const loadMore = useCallback(() => {
    const s = stateRef.current
    if (s.page === 0 || s.page >= s.totalPages || inFlight.current) return
    void load(s.key, s.page + 1)
  }, [load])

  const retry = useCallback(() => {
    const s = stateRef.current
    void load(s.key, s.page + 1)
  }, [load])

  return {
    products: state.products,
    total: state.total,
    /** True until the first page of the current list has arrived. */
    loading: state.page === 0 && !error,
    loadingMore: loadingMore && state.page > 0,
    error,
    hasMore,
    loadMore,
    retry,
  }
}
