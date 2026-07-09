"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, DollarSign, MoreHorizontal,
} from "lucide-react"

const primary = [
  { label: "Dashboard",  href: "/admin",            icon: LayoutDashboard },
  { label: "Orders",     href: "/admin/orders",      icon: ShoppingCart },
  { label: "Products",   href: "/admin/products",    icon: Package },
  { label: "Affiliates", href: "/admin/affiliates",  icon: Users },
  { label: "Earnings",   href: "/admin/commissions", icon: DollarSign },
]

export default function AdminMobileNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border safe-area-pb">
      <div className="flex">
        {primary.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-faint hover:text-muted"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
