"use client"

import Link from "next/link"
import { ShoppingCart, User , Heart } from "lucide-react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import SearchBar from "../products/SearchBar"

export default function Navbar() {
  const user = useAuthStore((s) => s.user)
  const items = useCartStore((s) => s.items)

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
          {!!items.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {items.length}
            </span>
          )}
        </Link>
        <Link href="/cart" className="relative">
          <ShoppingCart />
          {!!items.length && (
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 rounded-full">
              {items.length}
            </span>
          )}
        </Link>

        {user ? (
          <Link href="/profile">
            <User />
          </Link>
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
