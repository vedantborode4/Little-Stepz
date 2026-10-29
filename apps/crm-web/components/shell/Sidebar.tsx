"use client"

import clsx from "clsx"
import { LogOut, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ROLE_LABELS } from "@repo/crm-schema"
import { signOut } from "@/features/auth/api"
import { dashboardItem, isActivePath, navSections, SHIPPED_PHASE, type NavItem } from "@/lib/nav"
import { useAuthStore, useCan } from "@/store/auth.store"
import ThemeToggle from "./ThemeToggle"

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = isActivePath(pathname, item.href)
  const upcoming = item.phase > SHIPPED_PHASE
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
        active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-primary/5 hover:text-primary",
      )}
    >
      <Icon size={17} className={active ? "text-white" : "text-faint"} />
      <span className="flex-1 truncate">{item.label}</span>
      {upcoming && !active && <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">Soon</span>}
    </Link>
  )
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const can = useCan()

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border h-dvh sticky top-0 flex flex-col">
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">LS</span>
            </div>
            <span className="font-bold text-text text-sm">Little Stepz</span>
          </div>
          <p className="text-[10px] text-faint mt-0.5 ml-10">Business CRM</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-xl text-faint hover:bg-surface-2 transition lg:hidden">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain" aria-label="Main">
        {can(dashboardItem.permission) && <NavLink item={dashboardItem} onNavigate={onClose} />}
        {navSections.map((section) => {
          const items = section.items.filter((i) => can(i.permission))
          if (items.length === 0) return null
          return (
            <div key={section.title} className="mt-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{section.title}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} onNavigate={onClose} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 p-3 border-t border-border">
        {user && (
          <div className="px-3 pb-2">
            <p className="text-sm font-semibold text-text truncate">{user.name}</p>
            <p className="text-[11px] text-faint">{ROLE_LABELS[user.role]}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => signOut()}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-primary/5 hover:text-primary transition-all"
          >
            <LogOut size={17} className="text-faint" />
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
