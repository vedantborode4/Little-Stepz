"use client"

import { useState } from "react"
import AdminSidebar from "./AdminSidebar"
import AdminMobileNav from "./AdminMobileNav"
import ThemeToggle from "../common/ThemeToggle"
import { Menu } from "lucide-react"

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface-2">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between bg-surface border-b border-border px-4 h-14 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">LS</span>
            </div>
            <span className="font-bold text-text text-sm">Admin Panel</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-muted hover:bg-surface-2 transition"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6">{children}</div>

        {/* Mobile bottom nav */}
        <AdminMobileNav />
      </div>
    </div>
  )
}
