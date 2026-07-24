import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: true },
}

/**
 * Branded 404. Replaces the framework default, which returned an unstyled page
 * with no navigation — a dead end for both users and crawlers. `follow` keeps
 * link equity flowing through the recovery links below.
 */
export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center">
      <p className="font-mono text-sm tracking-widest text-muted">404</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-text">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 text-muted leading-relaxed">
        The page may have moved, or the link may be out of date. Try one of these
        instead.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/products"
          className="px-5 py-2.5 rounded-full bg-primary text-white font-semibold hover:opacity-90 transition"
        >
          Shop all products
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full border border-border text-text font-semibold hover:bg-surface-2 transition"
        >
          Go to homepage
        </Link>
      </div>

      <div className="mt-10 pt-8 border-t border-border text-sm">
        <p className="text-muted mb-3">Popular categories</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {[
            ["Licensed Cars", "licensed-cars"],
            ["Diecast Cars", "die-cast-cars"],
            ["Hot Wheels", "hot-wheels"],
            ["Stanley Bottles", "stanley-bottles"],
            ["Building Blocks", "blocks"],
            ["RC Crawlers", "rc-crawlers"],
          ].map(([label, slug]) => (
            <Link
              key={slug}
              href={`/products/category/${slug}`}
              className="text-primary hover:underline"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
