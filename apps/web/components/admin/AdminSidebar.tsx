"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import ThemeToggle from "../common/ThemeToggle"
import {
  LayoutDashboard, ShoppingCart, Package, Users, Ticket,
  Star, Image, FolderTree, DollarSign, Wallet, Home, X, CalendarClock, TrendingUp, Bell,
} from "lucide-react"

// Standalone item shown above the grouped sections.
const dashboard = { label: "Dashboard", href: "/admin", icon: LayoutDashboard }

// Grouped nav — each section gets an uppercase header.
const sections = [
  {
    title: "Catalogue",
    items: [
      { label: "Products",   href: "/admin/products",   icon: Package },
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
      { label: "Banners",    href: "/admin/banners",    icon: Image },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Orders",     href: "/admin/orders",     icon: ShoppingCart },
      { label: "Pre-Orders", href: "/admin/pre-orders", icon: CalendarClock },
      { label: "Coupons",    href: "/admin/coupons",    icon: Ticket },
      { label: "Reviews",    href: "/admin/reviews",    icon: Star },
    ],
  },
  {
    title: "Affiliate",
    items: [
      { label: "Affiliates",  href: "/admin/affiliates",  icon: Users },
      { label: "Commissions", href: "/admin/commissions", icon: DollarSign },
      { label: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Profit & Loss", href: "/admin/profit-loss", icon: TrendingUp },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
]

interface Props { onClose?: () => void }

export default function AdminSidebar({ onClose }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 bg-surface border-r border-border min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">LS</span>
            </div>
            <span className="font-bold text-text text-sm">Little Stepz</span>
          </div>
          <p className="text-[10px] text-faint mt-0.5 ml-10">Admin Panel</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-xl text-faint hover:bg-surface-2 transition lg:hidden">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {(() => {
          const Icon = dashboard.icon
          const active = isActive(dashboard.href)
          return (
            <Link
              href={dashboard.href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-primary/5 hover:text-primary"
              )}
            >
              <Icon size={17} className={active ? "text-white" : "text-faint"} />
              {dashboard.label}
            </Link>
          )
        })()}

        {sections.map((section) => (
          <div key={section.title} className="mt-4 first:mt-3">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      active
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    <Icon size={17} className={active ? "text-white" : "text-faint"} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border flex items-center gap-1">
        <Link
          href="/"
          onClick={onClose}
          className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-primary/5 hover:text-primary transition-all"
        >
          <Home size={17} className="text-faint" />
          Back to Store
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  )
}
