"use client"

import { Bell, Search } from "lucide-react"
import { useAuthStore } from "../../store/auth.store"
import { usePathname } from "next/navigation"

const routeLabels: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/orders": "Orders",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/affiliates": "Affiliates",
  "/admin/commissions": "Commissions",
  "/admin/withdrawals": "Withdrawals",
  "/admin/coupons": "Coupons",
  "/admin/reviews": "Reviews",
  "/admin/banners": "Banners",
}

export default function AdminTopbar() {
  const { user } = useAuthStore()
  const pathname = usePathname()
  const pageLabel = Object.entries(routeLabels)
    .filter(([key]) => pathname.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "Admin"

  return (
    <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search…"
          className="border border-gray-200 rounded-xl pl-9 pr-4 py-2 w-80 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50"
        />
      </div>

      <div className="flex items-center gap-3">


        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {user?.name ?? "Admin"}
          </span>
        </div>
      </div>
    </div>
  )
}
