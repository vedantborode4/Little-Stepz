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
} from "lucide-react"

const items = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Affiliates", href: "/admin/affiliates", icon: Users },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Banners", href: "/admin/banners", icon: Image },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r min-h-screen p-4">

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2 rounded-lg text-sm",
                pathname === item.href
                  ? "bg-primary text-white"
                  : "hover:bg-gray-100"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}