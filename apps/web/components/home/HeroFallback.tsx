import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

const STATS = [
  { value: "500+", label: "Cities" },
  { value: "22+",  label: "Products" },
  { value: "100%", label: "Authentic" },
  { value: "48h",  label: "Dispatch" },
]

// Default hero shown when no HOME_HERO banner is active.
export default function HeroFallback() {
  return (
    <section className="relative w-full overflow-hidden bg-bg lg:aspect-32/15">
      {/* soft themed backdrop */}
      <div className="pointer-events-none absolute -right-32 top-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative lg:h-full max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-8 lg:gap-6 items-center py-12 sm:py-16 lg:py-0">

        {/* LEFT — copy */}
        <div className="order-2 lg:order-1">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/70 px-4 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Now Shipping Pan-India · 500+ Cities
          </span>

          {/* Heading */}
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-text">
            India&apos;s #1 Store for{" "}
            <span className="text-primary underline decoration-primary/50 underline-offset-[6px]">RC Cars</span>{" "}
            &amp; Collectibles
          </h1>

          {/* Subtitle */}
          <p className="mt-5 max-w-md text-sm sm:text-base text-muted leading-relaxed">
            Directly imported premium RC cars, diecast models and collectibles — delivered anywhere in India.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-primary/20 hover:opacity-90 transition"
            >
              Shop Now <ArrowRight size={16} />
            </Link>
            <Link
              href="/affiliate/apply"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-7 py-3 text-sm font-semibold text-text hover:border-primary/40 hover:text-primary transition"
            >
              Wholesale Enquiry
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-4 sm:gap-x-10">
            {STATS.map((s, i) => (
              <div key={s.label} className={i > 0 ? "pl-6 sm:pl-10 border-l border-gray-200" : ""}>
                <p className="text-2xl sm:text-3xl font-bold text-text leading-none">{s.value}</p>
                <p className="mt-1 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — showcase image */}
        <div className="order-1 lg:order-2 relative">
          <div className="relative w-full aspect-4/3 lg:aspect-square">
            <Image
              src="/bronco.webp"
              alt="Premium RC car"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain drop-shadow-xl"
            />
          </div>
        </div>

      </div>
    </section>
  )
}
