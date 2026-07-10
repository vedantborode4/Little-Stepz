import Link from "next/link"
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter, Youtube } from "lucide-react"
import PaymentBadges from "../common/PaymentBadges"

function ThreadsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.065 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.756-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 00-2.215-.221Z" />
    </svg>
  )
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/littlestepzofficial", icon: <Instagram size={14} /> },
  { label: "Facebook", href: "https://www.facebook.com/share/1BYNjMRyJJ/", icon: <Facebook size={14} /> },
  { label: "X", href: "https://x.com/LittlestepzOff", icon: <Twitter size={14} /> },
  { label: "YouTube", href: "https://youtube.com/@littlestepzofficial", icon: <Youtube size={14} /> },
  { label: "Threads", href: "https://www.threads.com/@littlestepzofficial", icon: <ThreadsIcon size={13} /> },
  { label: "WhatsApp", href: "https://whatsapp.com/channel/0029VbD0g0j29753jCnp7U31", icon: <WhatsAppIcon size={13} /> },
]

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
            <div className="flex flex-wrap gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary transition"
                >
                  {s.icon}
                </a>
              ))}
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-gray-500">We accept</p>
              <PaymentBadges />
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
                { label: "Stanley Bottles", slug: "stanley-bottles" },
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
                { label: "FAQ", href: "/faq" },
                { label: "Track Order", href: "/account/orders" },
                { label: "Unboxing Policy", href: "/unboxing-policy" },
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
                <a href="tel:+919920634567" className="hover:text-white transition-colors">+91 99206 34567</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-gray-500 shrink-0" />
                <a href="mailto:Support@littlestepz.in" className="hover:text-white transition-colors">Support@littlestepz.in</a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-gray-500 shrink-0" />
                <span>Hyderabad, India</span>
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
