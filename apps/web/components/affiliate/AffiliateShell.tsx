"use client"

import { usePathname } from "next/navigation"

import { useCallback, useEffect, useState } from "react"
import AffiliateSidebar from "./AffiliateSidebar"
import AffiliateMobileNav from "./AffiliateMobileNav"
import { Menu, X } from "lucide-react"

/**
 * Drawer plumbing shared by both panels.
 *
 * Locking body scroll is the half that matters: without it the page behind the
 * open drawer keeps scrolling under the finger, which is what made the panel feel
 * broken on a phone. Escape and route changes close it so the drawer can never be
 * left open over content the user has already navigated away from.
 */
function useDrawer(open: boolean, close: () => void) {
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  // Close on navigation — the sidebar links do call onClose, but a browser back
  // button or any programmatic push would otherwise leave it hanging open.
  useEffect(() => { close() }, [pathname, close])
}

export default function AffiliateShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  useDrawer(sidebarOpen, closeSidebar)

  return (
    <div className="flex min-h-screen bg-surface-2">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <AffiliateSidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <div className="relative z-50 flex">
            <AffiliateSidebar onClose={closeSidebar} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar with hamburger */}
        <div className="lg:hidden flex items-center justify-between bg-surface border-b border-border px-4 h-14 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">LS</span>
            </div>
            <span className="font-bold text-text text-sm">Affiliate Panel</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-muted hover:bg-surface-2 transition"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 p-4 sm:p-6">{children}</div>

        {/* Mobile bottom navigation */}
        <AffiliateMobileNav />
      </div>
    </div>
  )
}
