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
} from "lucide-react"

const items = [
  { label: "Overview",    href: "/affiliate",             icon: LayoutDashboard },
  { label: "Clicks",      href: "/affiliate/clicks",      icon: MousePointerClick },
  { label: "Conversions", href: "/affiliate/conversions", icon: ArrowLeftRight },
  { label: "Commissions", href: "/affiliate/commissions", icon: DollarSign },
  { label: "Orders",      href: "/affiliate/orders",      icon: ShoppingBag },
  { label: "Payout",      href: "/affiliate/payout",      icon: Wallet },
]

export default function AffiliateMobileNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/affiliate") return pathname === "/affiliate"
    return pathname.startsWith(href)
  }

  return (
    <nav className="lg:hidden sticky bottom-0 z-40 bg-white border-t border-gray-100 safe-area-pb">
      <div className="flex overflow-x-auto scrollbar-none">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 min-w-[60px] flex-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
