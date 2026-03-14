"use client"

import Link from "next/link"
import { ShoppingCart, Heart, LogOut, User, ChevronDown, Menu, X, Package, Percent, LayoutDashboard } from "lucide-react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import { useCategoryStore } from "../../store/useCategoryStore"
import { useAffiliateStore } from "../../store/affiliate.store"
import SearchBar from "../products/SearchBar"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../hooks/use-auth"
import { usePathname } from "next/navigation"
import clsx from "clsx"

export default function Navbar() {
  const { user, isHydrated } = useAuthStore()
  const cartItems = useCartStore((s) => s.items)
  const wishlistItems = useWishlistStore((s) => s.items)
  const { tree } = useCategoryStore()
  const { signOut } = useAuth()
  const affiliateProfile = useAffiliateStore((s) => s.profile)
  const pathname = usePathname()

  const [openUser, setOpenUser] = useState(false)
  const [openMega, setOpenMega] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const megaTimeout = useRef<NodeJS.Timeout | null>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  }, [])

  useEffect(() => {
    if (user) useAffiliateStore.getState().fetchAffiliate()
  }, [user])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setOpenUser(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const openMegaMenu = () => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current)
    setOpenMega(true)
  }
  const closeMegaMenu = () => {
    megaTimeout.current = setTimeout(() => setOpenMega(false), 220)
  }

  // Don't render navbar in admin/affiliate panels
  if (!isHydrated) return null
  if (pathname.startsWith("/admin") || pathname.startsWith("/affiliate")) return null

  const isAdmin = user?.role === "ADMIN"

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <img src="/logo.png" alt="Little Stepz" className="h-11 w-auto" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center text-sm font-medium">
              {/* Categories mega menu */}
              <div
                className="relative"
                onMouseEnter={openMegaMenu}
                onMouseLeave={closeMegaMenu}
              >
                <button className={clsx(
                  "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  openMega ? "text-primary bg-primary/5" : "text-gray-600 hover:text-primary hover:bg-gray-50"
                )}>
                  Categories
                  <ChevronDown size={14} className={clsx("transition-transform", openMega && "rotate-180")} />
                </button>

                {/* Bridge to prevent flicker */}
                <div className="absolute left-0 top-full h-3 w-full" />

                <div className={clsx(
                  "absolute left-0 top-full pt-3 transition-all duration-200",
                  openMega ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
                )}>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 w-[640px] max-h-[70vh] overflow-y-auto grid grid-cols-3 gap-6">
                    {tree.map((parent) => (
                      <div key={parent.id}>
                        <Link
                          href={`/products/category/${parent.slug}`}
                          className="font-semibold text-gray-900 text-sm block mb-2.5 hover:text-primary transition-colors"
                          onClick={() => setOpenMega(false)}
                        >
                          {parent.name}
                        </Link>
                        <div className="space-y-1.5">
                          {parent.children?.map((child) => (
                            <Link
                              key={child.id}
                              href={`/products/category/${child.slug}`}
                              className="block text-xs text-gray-500 hover:text-primary transition-colors"
                              onClick={() => setOpenMega(false)}
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                    {tree.length === 0 && (
                      <p className="col-span-3 text-sm text-gray-400 text-center py-4">Loading categories…</p>
                    )}
                  </div>
                </div>
              </div>

              <Link href="/products" className="px-3 py-2 rounded-lg text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors">
                All Products
              </Link>
            </nav>

            {/* Search */}
            <div className="flex-1 max-w-md hidden md:block">
              <SearchBar />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto md:ml-0">
              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2 rounded-lg text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors">
                <Heart size={20} />
                {wishlistItems.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishlistItems.length > 9 ? "9+" : wishlistItems.length}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <Link href="/cart" className="relative p-2 rounded-lg text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors">
                <ShoppingCart size={20} />
                {cartItems.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartItems.length > 9 ? "9+" : cartItems.length}
                  </span>
                )}
              </Link>

              {/* User menu */}
              {user ? (
                <div className="relative" ref={userRef}>
                  <button
                    onClick={() => setOpenUser((p) => !p)}
                    className={clsx(
                      "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors text-sm font-medium",
                      openUser ? "bg-primary/5 text-primary" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <div className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs">
                      {user.name?.[0]?.toUpperCase() ?? <User size={14} />}
                    </div>
                    <span className="hidden lg:block max-w-[100px] truncate">{user.name?.split(" ")[0]}</span>
                    <ChevronDown size={13} className={clsx("transition-transform text-gray-400", openUser && "rotate-180")} />
                  </button>

                  {openUser && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 overflow-hidden">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-50">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>

                      <div className="py-1">
                        <MenuItem href="/profile" icon={User} label="My Profile" onClick={() => setOpenUser(false)} />
                        <MenuItem href="/account/orders" icon={Package} label="My Orders" onClick={() => setOpenUser(false)} />

                        {isAdmin && (
                          <MenuItem href="/admin" icon={LayoutDashboard} label="Admin Panel" onClick={() => setOpenUser(false)} accent />
                        )}

                        {affiliateProfile?.status === "APPROVED" && (
                          <MenuItem href="/affiliate" icon={Percent} label="Affiliate Dashboard" onClick={() => setOpenUser(false)} />
                        )}
                        {affiliateProfile?.status === "PENDING" && (
                          <div className="px-4 py-2 flex items-center gap-2.5">
                            <span className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                            </span>
                            <span className="text-xs text-amber-600 font-medium">Affiliate Pending</span>
                          </div>
                        )}
                        {!affiliateProfile && (
                          <MenuItem href="/affiliate/apply" icon={Percent} label="Become Affiliate" onClick={() => setOpenUser(false)} />
                        )}
                      </div>

                      <div className="border-t border-gray-50 pt-1">
                        <button
                          onClick={() => { signOut(); setOpenUser(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={15} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/signin"
                  className="ml-1 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
                >
                  Login
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileOpen((p) => !p)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-3">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <img src="/logo.png" alt="Little Stepz" className="h-9 w-auto" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-50">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              <MobileLink href="/products" label="All Products" />
              {tree.map((parent) => (
                <div key={parent.id}>
                  <MobileLink href={`/products/category/${parent.slug}`} label={parent.name} bold />
                  {parent.children?.map((child) => (
                    <MobileLink key={child.id} href={`/products/category/${child.slug}`} label={child.name} indent />
                  ))}
                </div>
              ))}
            </nav>

            {user && (
              <div className="p-4 border-t border-gray-100 space-y-1">
                <MobileLink href="/profile" label="My Profile" />
                <MobileLink href="/account/orders" label="My Orders" />
                {affiliateProfile?.status === "APPROVED" && <MobileLink href="/affiliate" label="Affiliate Dashboard" />}
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MenuItem({ href, icon: Icon, label, onClick, accent }: {
  href: string; icon: any; label: string; onClick: () => void; accent?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
        accent ? "text-primary hover:bg-primary/5" : "text-gray-700 hover:bg-gray-50"
      )}
    >
      <Icon size={15} className={accent ? "text-primary" : "text-gray-400"} />
      {label}
    </Link>
  )
}

function MobileLink({ href, label, bold, indent }: { href: string; label: string; bold?: boolean; indent?: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "block px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-gray-50",
        bold ? "font-semibold text-gray-900" : "text-gray-600",
        indent && "pl-6"
      )}
    >
      {label}
    </Link>
  )
}
