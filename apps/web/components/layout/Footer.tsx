import Link from "next/link"
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-[#282828] text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">

          {/* Brand — full width on mobile */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Little Stepz" className="h-10 w-auto" />
            <p className="text-sm text-gray-400 leading-relaxed">
              Safe, fun, and thoughtfully designed toys that help children learn through play.
            </p>
            <div className="flex gap-3">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary transition">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm">Categories</h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Blocks", slug: "blocks" },
                { label: "Die Cast Cars", slug: "die-cast-cars" },
                { label: "Hyper go Cars", slug: "hyper-go-cars" },
                { label: "Licensed Cars", slug: "licensed-cars" },
                { label: "RC Cars", slug: "rc-cars" },
                { label: "Stanley Cars", slug: "stanley-cars" },
              ].map((item) => (
                <li key={item.slug}>
                  <Link href={`/products/category/${item.slug}`} className="text-gray-400 hover:text-white transition text-xs sm:text-sm">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm">Information</h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "About Us", href: "/about" },
                { label: "Shipping Policy", href: "/shipping" },
                { label: "Returns & Refund", href: "/returns" },
                { label: "Cancellation Policy", href: "/cancellation" },
                { label: "Warranty & Safety", href: "/warranty" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms & Conditions", href: "/terms" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gray-400 hover:text-white transition text-xs sm:text-sm">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 sm:col-span-1 space-y-3 sm:space-y-4">
            <h4 className="font-semibold text-white text-sm">Stay Updated</h4>
            <div className="space-y-2 text-xs sm:text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-gray-500 shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-gray-500 shrink-0" />
                <span>hello@littlestepz.in</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-gray-500 shrink-0" />
                <span>Mumbai, India</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-8 sm:mt-10 pt-5 sm:pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500 text-center">
          <p>© {new Date().getFullYear()} Little Stepz. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a
              href="https://novixs.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              Novixs Web Services
            </a>
          </p>
          <p>Made with ♥ for little ones</p>
        </div>
      </div>
    </footer>
  )
}
