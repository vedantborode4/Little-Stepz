import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import CountUp from "../common/CountUp"

const STATS = [
  { value: "500+", label: "Cities" },
  { value: "22+",  label: "Products" },
  { value: "100%", label: "Authentic" },
  { value: "48h",  label: "Dispatch" },
]

// Default hero shown when no HOME_HERO banner is active.
export default function HeroFallback() {
  return (
    <section className="relative w-full overflow-hidden bg-bg lg:min-h-[calc(100vh-4rem)] lg:flex lg:items-center">
      {/* soft themed backdrop — centered */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center py-12 sm:py-16 lg:py-20">

        {/* COPY */}
        <div className="flex flex-col items-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface/70 px-4 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Now Shipping Pan-India · 500+ Cities
          </span>

          {/* Heading — forced 3 lines on sm+, natural wrap on mobile to avoid overflow */}
          <h1 className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] sm:leading-[1.05] text-text text-center text-balance wrap-break-word">
            India&apos;s #1 Store for{" "}
            <br className="hidden sm:block" />
            <span className="text-primary underline decoration-primary/50 underline-offset-[6px]">RC Cars</span>{" "}
            &amp;{" "}
            <br className="hidden sm:block" />
            Collectibles
          </h1>

          {/* Subtitle */}
          <p className="mt-5 max-w-md mx-auto text-sm sm:text-base text-muted leading-relaxed">
            Directly imported premium RC cars, diecast models and collectibles — delivered anywhere in India.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-7 py-3 text-sm font-sora font-semibold uppercase tracking-wide text-white shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              {/* flash sweep on hover */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-linear-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative inline-flex items-center gap-2">
                Shop Now <ArrowRight size={16} />
              </span>
            </Link>
            <Link
              href="/pre-orders"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-7 py-3 text-sm font-sora font-semibold text-text hover:border-primary/40 hover:text-primary transition"
            >
              Pre-Order
            </Link>
          </div>

          {/* Stats / counters */}
          <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-x-6 gap-y-5 sm:gap-x-10 w-full max-w-sm sm:max-w-none">
            {STATS.map((s, i) => (
              <div key={s.label} className={i > 0 ? "sm:pl-10 sm:border-l sm:border-border" : ""}>
                <p className="font-anton text-2xl sm:text-3xl text-text leading-none tracking-wide">
                  <CountUp value={s.value} delay={i * 120} />
                </p>
                <p className="mt-1 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SHOWCASE IMAGE — hidden for now */}
        <div className="hidden relative">
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
