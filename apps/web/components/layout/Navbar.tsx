"use client"

import Link from "next/link"
import { ShoppingCart, Heart, LogOut, User, ChevronDown, Menu, X, Package, Percent, LayoutDashboard, ChevronRight, Search } from "lucide-react"
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
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
  useEffect(() => {
    setMobileOpen(false)
    setMobileSearchOpen(false)
  }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

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
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : null

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-3">

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

            {/* Desktop Search */}
            <div className="flex-1 max-w-md hidden md:block">
              <SearchBar />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto md:ml-0">

              {/* Mobile: search toggle */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => setMobileSearchOpen((p) => !p)}
                aria-label="Search"
              >
                <Search size={20} />
              </button>

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

              {/* Desktop User menu */}
              {user ? (
                <div className="relative hidden md:block" ref={userRef}>
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
                  className="hidden md:flex ml-1 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
                >
                  Login
                </Link>
              )}

              {/* Mobile: hamburger */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => setMobileOpen((p) => !p)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile: expandable search bar */}
          <div className={clsx(
            "md:hidden overflow-hidden transition-all duration-200",
            mobileSearchOpen ? "max-h-16 pb-3 opacity-100" : "max-h-0 opacity-0"
          )}>
            <SearchBar />
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      {/* Backdrop */}
      <div
        className={clsx(
          "md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className={clsx(
          "md:hidden fixed top-0 right-0 h-full w-[300px] bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <img src="/logo.png" alt="Little Stepz" className="h-9 w-auto" />
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* User info strip — shown when logged in */}
        {user && (
          <div className="px-5 py-3.5 bg-primary/5 border-b border-primary/10 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {initials ?? <User size={16} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Scrollable nav area */}
        <nav className="flex-1 overflow-y-auto">

          {/* Quick actions — cart + wishlist */}
          <div className="grid grid-cols-2 gap-2.5 px-4 pt-4 pb-2">
            <Link
              href="/cart"
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 hover:bg-primary/5 hover:border-primary/20 transition-colors"
            >
              <div className="relative flex-shrink-0">
                <ShoppingCart size={18} className="text-gray-600" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartItems.length > 9 ? "9+" : cartItems.length}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">Cart</span>
            </Link>
            <Link
              href="/wishlist"
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 hover:bg-primary/5 hover:border-primary/20 transition-colors"
            >
              <div className="relative flex-shrink-0">
                <Heart size={18} className="text-gray-600" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {wishlistItems.length > 9 ? "9+" : wishlistItems.length}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">Wishlist</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-gray-100" />

          {/* All Products */}
          <div className="px-3 pb-1">
            <MobileNavLink href="/products" icon={<ShoppingCart size={15} className="text-gray-400" />} label="All Products" />
          </div>

          {/* Categories with accordion */}
          {tree.length > 0 && (
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">
                Categories
              </p>
              <div className="space-y-0.5">
                {tree.map((parent) => (
                  <div key={parent.id}>
                    {/* Parent row — tappable to expand or navigate */}
                    {parent.children?.length ? (
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === parent.id ? null : parent.id
                          )
                        }
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span>{parent.name}</span>
                        <ChevronRight
                          size={15}
                          className={clsx(
                            "text-gray-400 transition-transform duration-200 flex-shrink-0",
                            expandedCategory === parent.id && "rotate-90"
                          )}
                        />
                      </button>
                    ) : (
                      <Link
                        href={`/products/category/${parent.slug}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                      >
                        {parent.name}
                      </Link>
                    )}

                    {/* Children — accordion */}
                    {(parent.children?.length ?? 0) > 0 && expandedCategory === parent.id && (
                      <div className="ml-3 pl-3 border-l-2 border-primary/20 mt-0.5 mb-1 space-y-0.5">
                        <Link
                          href={`/products/category/${parent.slug}`}
                          className="flex items-center px-3 py-2 rounded-xl text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
                        >
                          All {parent.name}
                        </Link>
                        {(parent.children ?? []).map((child) => (
                          <Link
                            key={child.id}
                            href={`/products/category/${child.slug}`}
                            className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account links — shown when logged in */}
          {user && (
            <div className="px-3 pb-2">
              <div className="mx-0 my-2 border-t border-gray-100" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">
                Account
              </p>
              <div className="space-y-0.5">
                <MobileNavLink href="/profile" icon={<User size={15} className="text-gray-400" />} label="My Profile" />
                <MobileNavLink href="/account/orders" icon={<Package size={15} className="text-gray-400" />} label="My Orders" />
                {isAdmin && (
                  <MobileNavLink href="/admin" icon={<LayoutDashboard size={15} className="text-primary" />} label="Admin Panel" accent />
                )}
                {affiliateProfile?.status === "APPROVED" && (
                  <MobileNavLink href="/affiliate" icon={<Percent size={15} className="text-gray-400" />} label="Affiliate Dashboard" />
                )}
                {affiliateProfile?.status === "PENDING" && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50">
                    <span className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    </span>
                    <span className="text-xs text-amber-600 font-medium">Affiliate approval pending</span>
                  </div>
                )}
                {!affiliateProfile && (
                  <MobileNavLink href="/affiliate/apply" icon={<Percent size={15} className="text-gray-400" />} label="Become Affiliate" />
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Drawer footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-4 pb-safe">
          {user ? (
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          ) : (
            <div className="space-y-2">
              <Link
                href="/signin"
                className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:opacity-90 transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Desktop dropdown item ──────────────────────────────────────────────────
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

// ── Mobile drawer nav link ────────────────────────────────────────────────
function MobileNavLink({ href, icon, label, accent }: {
  href: string; icon: React.ReactNode; label: string; accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
        accent
          ? "text-primary font-semibold hover:bg-primary/5"
          : "text-gray-700 font-medium hover:bg-gray-50"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </Link>
  )
}