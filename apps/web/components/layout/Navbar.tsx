"use client"

import Link from "next/link"
import {
  ShoppingCart,
  User,
  Heart,
  LogOut,
} from "lucide-react"

import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import { useCategoryStore } from "../../store/useCategoryStore"
import { useAffiliateStore } from "../../store/affiliate.store"

import SearchBar from "../products/SearchBar"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../hooks/use-auth"
import clsx from "clsx"

export default function Navbar() {
  const { user, isHydrated } = useAuthStore()

  const cartItems = useCartStore((s) => s.items)
  const wishlistItems = useWishlistStore((s) => s.items)

  const { tree } = useCategoryStore()
  const { signOut } = useAuth()

  /* ---------------- AFFILIATE ---------------- */
  const affiliateProfile = useAffiliateStore((s) => s.profile)

  /* ---------------- UI STATE ---------------- */
  const [openUser, setOpenUser] = useState(false)
  const [openMega, setOpenMega] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // ✅ FIX: removed `fetchTree` from deps — it's a Zustand action and gets a new
    // reference every render, which would cause this effect to re-run endlessly.
    // We only want to fetch once when the tree is empty (on mount).
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // ✅ FIX: same pattern — read stable action from getState().
    // `user` is the only real dependency: re-fetch affiliate when user changes.
    if (user) useAffiliateStore.getState().fetchAffiliate()
  }, [user])

  const openMegaMenu = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpenMega(true)
  }

  const closeMegaMenu = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenMega(false)
    }, 220)
  }

  if (!isHydrated) return null

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">

        <Link href="/">
          <img
            src="/logo.png"
            alt="Little Stepz Logo"
            className="h-12 w-28"
          />
        </Link>

        {/* ================= DESKTOP NAV ================= */}

        <nav className="hidden md:flex gap-6 text-sm font-medium relative">

          {/* CATEGORY */}
          <div
            className="relative"
            onMouseEnter={openMegaMenu}
            onMouseLeave={closeMegaMenu}
          >
            <button className="hover:text-primary">
              Category
            </button>

            <div className="absolute left-0 top-full h-4 w-full" />

            <div
              className={clsx(
                "absolute left-0 top-full pt-4 transition-all duration-200",
                openMega
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              )}
            >
              <div className="bg-white border rounded-2xl shadow-xl p-6
                              min-w-[720px] max-w-[1000px]
                              max-h-[70vh] overflow-y-auto
                              grid grid-cols-3 gap-8">

                {tree.map((parent) => (
                  <div key={parent.id}>

                    <Link
                      href={`/products/category/${parent.slug}`}
                      className="font-semibold text-primary block mb-3 hover:underline"
                    >
                      {parent.name}
                    </Link>

                    <div className="space-y-1">
                      {parent.children?.map((child) => (
                        <Link
                          key={child.id}
                          href={`/products/category/${child.slug}`}
                          className="block text-sm text-muted hover:text-primary"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>

                  </div>
                ))}

              </div>
            </div>
          </div>

          <Link href="/brands">Brands</Link>
          <Link href="/age">Age</Link>
          <Link href="/offers">Offers</Link>

        </nav>

        {/* SEARCH */}
        <div className="flex-1 max-w-xl">
          <SearchBar />
        </div>

        {/* WISHLIST */}
        <Link href="/wishlist" className="relative">
          <Heart />
          {!!wishlistItems.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {wishlistItems.length}
            </span>
          )}
        </Link>

        {/* CART */}
        <Link href="/cart" className="relative">
          <ShoppingCart />
          {!!cartItems.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {cartItems.length}
            </span>
          )}
        </Link>

        {/* USER MENU */}
        {user ? (
          <div className="relative">
            <button onClick={() => setOpenUser((p) => !p)}>
              <User />
            </button>

            {openUser && (
              <div className="absolute right-0 mt-2 w-52 bg-white border rounded-xl shadow-md py-2 text-sm">

                <Link
                  href="/profile"
                  className="block px-4 py-2 hover:bg-gray-50"
                  onClick={() => setOpenUser(false)}
                >
                  Profile
                </Link>

                <Link
                  href="/account/orders"
                  className="block px-4 py-2 hover:bg-gray-50"
                  onClick={() => setOpenUser(false)}
                >
                  Orders
                </Link>


                {affiliateProfile?.status === "APPROVED" && (
                  <Link
                    href="/affiliate"
                    className="block px-4 py-2 hover:bg-gray-50"
                    onClick={() => setOpenUser(false)}
                  >
                    Affiliate Dashboard
                  </Link>
                )}

                {!affiliateProfile && (
                  <Link
                    href="/affiliate/apply"
                    className="block px-4 py-2 hover:bg-gray-50"
                    onClick={() => setOpenUser(false)}
                  >
                    Become an Affiliate
                  </Link>
                )}

                {affiliateProfile?.status === "PENDING" && (
                  <div className="px-4 py-2 text-xs text-muted">
                    Affiliate (Pending)
                  </div>
                )}

                <button
                  onClick={signOut}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-500"
                >
                  <LogOut size={16} /> Logout
                </button>

              </div>
            )}
          </div>
        ) : (
          <Link
            href="/signin"
            className="border px-4 py-1.5 rounded-lg text-sm"
          >
            Login
          </Link>
        )}

      </div>
    </header>
  )
}