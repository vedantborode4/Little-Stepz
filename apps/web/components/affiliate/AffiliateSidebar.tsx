"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  LayoutDashboard,
  MousePointerClick,
  ShoppingBag,
  DollarSign,
  ArrowLeftRight,
  Wallet,
  Home,
  X,
} from "lucide-react"

const items = [
  { label: "Overview",    href: "/affiliate",             icon: LayoutDashboard },
  { label: "Clicks",      href: "/affiliate/clicks",      icon: MousePointerClick },
  { label: "Conversions", href: "/affiliate/conversions", icon: ArrowLeftRight },
  { label: "Commissions", href: "/affiliate/commissions", icon: DollarSign },
  { label: "Orders",      href: "/affiliate/orders",      icon: ShoppingBag },
  { label: "Payout",      href: "/affiliate/payout",      icon: Wallet },
]

interface Props {
  onClose?: () => void
}

export default function AffiliateSidebar({ onClose }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/affiliate") return pathname === "/affiliate"
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
          <p className="text-[10px] text-faint mt-0.5 ml-10">Affiliate Panel</p>
        </div>
        {/* Close button — only visible on mobile overlay */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-xl text-faint hover:bg-surface-2 transition"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
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
                  : "text-muted hover:bg-surface-2 hover:text-text"
              )}
            >
              <Icon size={17} className={active ? "text-white" : "text-faint"} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Back to store */}
      <div className="p-3 border-t border-border">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-surface-2 hover:text-text transition-all"
        >
          <Home size={17} className="text-faint" />
          Back to Store
        </Link>
      </div>
    </aside>
  )
}
