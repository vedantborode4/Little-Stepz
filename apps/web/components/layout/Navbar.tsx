"use client"

import Link from "next/link"
import { ShoppingCart, User, Heart, LogOut } from "lucide-react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import SearchBar from "../products/SearchBar"
import { useState } from "react"
import { useAuth } from "../../hooks/use-auth"

export default function Navbar() {
  const { user, isHydrated } = useAuthStore()
  const cartItems = useCartStore((s) => s.items)
  const wishlistItems = useWishlistStore((s) => s.items)

  const { signOut } = useAuth()

  const [open, setOpen] = useState(false)

  if (!isHydrated) return null

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">

        <Link href="/" className="text-xl font-bold text-primary">
          <img src="/logo.png" alt="Little Stepz Logo" className="h-12 w-28" />
        </Link>

        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <Link href="/products">Category</Link>
          <Link href="/brands">Brands</Link>
          <Link href="/age">Age</Link>
          <Link href="/offers">Offers</Link>
        </nav>

        <div className="flex-1 max-w-xl">
          <SearchBar />
        </div>

        <Link href="/wishlist" className="relative">
          <Heart />
          {!!wishlistItems.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {wishlistItems.length}
            </span>
          )}
        </Link>
        <Link href="/cart" className="relative">
          <ShoppingCart />
          {!!cartItems.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {cartItems.length}
            </span>
          )}
        </Link>

        {user ? (
          <div className="relative">
            <button onClick={() => setOpen((p) => !p)}>
              <User />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-44 bg-white border rounded-xl shadow-md py-2 text-sm">
                <Link
                  href="/profile"
                  className="block px-4 py-2 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  Profile
                </Link>

                <Link
                  href="/account/orders"
                  className="block px-4 py-2 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  Orders
                </Link>

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