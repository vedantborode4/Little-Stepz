import Link from "next/link"
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">LS</span>
              </div>
              <span className="font-bold text-white text-sm">Little Stepz</span>
            </div>
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
            <h4 className="font-semibold text-white mb-4 text-sm">Categories</h4>
            <ul className="space-y-2.5 text-sm">
              {["Action Figures", "Board Games", "Soft Toys", "Learning Toys", "Outdoor Play"].map((item) => (
                <li key={item}>
                  <Link href={`/products?search=${item.toLowerCase()}`} className="text-gray-400 hover:text-white transition">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Information</h4>
            <ul className="space-y-2.5 text-sm">
              {["About Us", "Contact Us", "Shipping Policy", "Return Policy", "Privacy Policy"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-white transition">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Newsletter */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white text-sm">Stay Updated</h4>
            <div className="flex gap-2">
              <input
                placeholder="Your email"
                className="flex-1 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition"
              />
              <button className="bg-primary px-4 rounded-xl text-white text-sm font-medium hover:opacity-90 transition">
                Go
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-gray-500 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-gray-500 flex-shrink-0" />
                <span>hello@littlestepz.in</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-gray-500 flex-shrink-0" />
                <span>Mumbai, India</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Little Stepz. All rights reserved.</p>
          <p>Made with ♥ for little ones</p>
        </div>
      </div>
    </footer>
  )
}
