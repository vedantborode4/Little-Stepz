"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCategoryStore } from "../../store/useCategoryStore"
import { useEffect } from "react"
import { Instagram, Twitter, Facebook, Youtube, MapPin, Mail, Phone } from "lucide-react"

export default function Footer() {
  const pathname = usePathname()
  const { tree } = useCategoryStore()

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/affiliate")) return
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  }, [])

  if (pathname.startsWith("/admin") || pathname.startsWith("/affiliate")) return null

  // Use real categories from API (first 6)
  const topCategories = tree.slice(0, 6)

  return (
    <footer className="bg-gray-950 text-gray-400 mt-20">
      {/* Top section */}
      <div className="max-w-7xl mx-auto px-6 pt-14 pb-10 grid md:grid-cols-4 gap-10">

        {/* Brand column */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">LS</span>
            </div>
            <span className="text-white font-bold text-base">Little Stepz</span>
          </div>
          <p className="text-sm leading-relaxed mb-5 text-gray-500">
            Premium toys & kids' products delivered to your doorstep. Making childhood magical.
          </p>
          <div className="flex gap-3">
            {[
              { icon: Instagram, href: "#" },
              { icon: Facebook, href: "#" },
              { icon: Twitter, href: "#" },
              { icon: Youtube, href: "#" },
            ].map(({ icon: Icon, href }, i) => (
              <a key={i} href={href} className="w-8 h-8 bg-white/5 hover:bg-primary/20 hover:text-primary rounded-lg flex items-center justify-center transition-colors">
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>

        {/* Shop categories */}
        <div>
          <h4 className="text-white text-sm font-semibold mb-4">Shop</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/products" className="hover:text-primary transition-colors">
                All Products
              </Link>
            </li>
            {topCategories.map((cat) => (
              <li key={cat.id}>
                <Link href={`/products/category/${cat.slug}`} className="hover:text-primary transition-colors">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Account */}
        <div>
          <h4 className="text-white text-sm font-semibold mb-4">Account</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/profile" className="hover:text-primary transition-colors">My Profile</Link></li>
            <li><Link href="/account/orders" className="hover:text-primary transition-colors">My Orders</Link></li>
            <li><Link href="/wishlist" className="hover:text-primary transition-colors">Wishlist</Link></li>
            <li><Link href="/cart" className="hover:text-primary transition-colors">Cart</Link></li>
            <li><Link href="/affiliate/apply" className="hover:text-primary transition-colors">Become Affiliate</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white text-sm font-semibold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <MapPin size={14} className="mt-0.5 text-primary flex-shrink-0" />
              <span>Mumbai, Maharashtra, India</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail size={14} className="text-primary flex-shrink-0" />
              <a href="mailto:support@littlestepz.in" className="hover:text-primary transition-colors">
                support@littlestepz.in
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone size={14} className="text-primary flex-shrink-0" />
              <a href="tel:+919876543210" className="hover:text-primary transition-colors">
                +91 98765 43210
              </a>
            </li>
          </ul>

          <div className="mt-6">
            <h4 className="text-white text-sm font-semibold mb-3">Newsletter</h4>
            <div className="flex gap-2">
              <input
                placeholder="Your email"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
              />
              <button className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition flex-shrink-0">
                Go
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 py-5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Little Stepz. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Use</Link>
            <Link href="/shipping" className="hover:text-gray-400 transition-colors">Shipping Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
