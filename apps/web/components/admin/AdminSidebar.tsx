"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  LayoutDashboard, ShoppingCart, Package, Users, Ticket,
  Star, Image, FolderTree, DollarSign, Wallet, Home, X, CalendarClock,
} from "lucide-react"

const items = [
  { label: "Dashboard",   href: "/admin",              icon: LayoutDashboard },
  { label: "Orders",      href: "/admin/orders",        icon: ShoppingCart },
  { label: "Pre-Orders",  href: "/admin/pre-orders",    icon: CalendarClock },
  { label: "Products",    href: "/admin/products",      icon: Package },
  { label: "Categories",  href: "/admin/categories",    icon: FolderTree },
  { label: "Affiliates",  href: "/admin/affiliates",    icon: Users },
  { label: "Commissions", href: "/admin/commissions",   icon: DollarSign },
  { label: "Withdrawals", href: "/admin/withdrawals",   icon: Wallet },
  { label: "Coupons",     href: "/admin/coupons",       icon: Ticket },
  { label: "Reviews",     href: "/admin/reviews",       icon: Star },
  { label: "Banners",     href: "/admin/banners",       icon: Image },
]

interface Props { onClose?: () => void }

export default function AdminSidebar({ onClose }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-100 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">LS</span>
            </div>
            <span className="font-bold text-gray-900 text-sm">Little Stepz</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 ml-10">Admin Panel</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 transition lg:hidden">
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
                  : "text-gray-600 hover:bg-primary/5 hover:text-primary"
              )}
            >
              <Icon size={17} className={active ? "text-white" : "text-gray-400"} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-primary/5 hover:text-primary transition-all"
        >
          <Home size={17} className="text-gray-400" />
          Back to Store
        </Link>
      </div>
    </aside>
  )
}
