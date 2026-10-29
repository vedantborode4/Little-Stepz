"use client"

import clsx from "clsx"
import { Boxes, LayoutDashboard, Menu, MoreHorizontal, ShoppingCart, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { isActivePath } from "@/lib/nav"
import Sidebar from "./Sidebar"
import ThemeToggle from "./ThemeToggle"

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

const mobileTabs = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "POS", href: "/pos", icon: ShoppingCart },
  { label: "Stock", href: "/inventory", icon: Boxes },
  { label: "Customers", href: "/customers", icon: Users },
]

/** Locks page scroll under the open drawer and closes it on Escape or navigation. */
function useDrawer(open: boolean, close: () => void) {
  const pathname = usePathname()
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, close])
  useEffect(() => close(), [pathname, close])
}

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  useDrawer(drawerOpen, closeDrawer)

  return (
    <div className="flex min-h-screen bg-surface-2">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative z-50">
            <Sidebar onClose={closeDrawer} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between bg-surface border-b border-border px-4 h-14 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">LS</span>
            </div>
            <span className="font-bold text-text text-sm">Little Stepz CRM</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl text-muted hover:bg-surface-2 transition"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {DEMO_MODE && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border-b border-yellow-200 dark:border-yellow-500/20 px-4 py-1.5 text-center text-xs font-medium text-yellow-800 dark:text-yellow-300">
            Demo environment — contains SAMPLE DATA. Not connected to littlestepz.in.
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 w-full max-w-[1600px] mx-auto">{children}</main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border safe-area-pb" aria-label="Quick">
          <div className="flex">
            {mobileTabs.map(({ label, href, icon: Icon }) => {
              const active = isActivePath(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-faint hover:text-muted",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              )
            })}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-medium text-faint hover:text-muted"
            >
              <MoreHorizontal size={18} />
              More
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}
