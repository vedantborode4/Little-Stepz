"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Ticket,
  Star,
  Image,
  FolderTree,
  DollarSign,
  Wallet,
} from "lucide-react"

const items = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
  { label: "Affiliates", href: "/admin/affiliates", icon: Users },
  { label: "Commissions", href: "/admin/commissions", icon: DollarSign },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Banners", href: "/admin/banners", icon: Image },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-100 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">LS</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">Little Stepz</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 ml-10">Admin Panel</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={17} className={active ? "text-white" : "text-gray-400"} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
