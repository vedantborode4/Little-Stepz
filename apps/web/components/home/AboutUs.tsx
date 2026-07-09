const FEATURES = [
  {
    emoji: "🏎️",
    iconBg: "bg-primary/10",
    title: "RC Cars & Diecast",
    desc: "Officially licensed RC cars — Ferrari, Bugatti, Mercedes, Lamborghini. Premium 1:12 scale diecast hypercar models sourced directly from global manufacturers.",
  },
  {
    emoji: "🚚",
    iconBg: "bg-secondary/15",
    title: "Pan-India Delivery",
    desc: "Shipping to 500+ cities across India. Direct importer, wholesaler and retailer — no middlemen, 100% authentic products at your doorstep.",
  },
  {
    emoji: "🏆",
    iconBg: "bg-primary/10",
    title: "Collectibles",
    desc: "Rare limited-edition figures, licensed Stanley tumblers, hobby-grade rock crawlers and exclusive imports — curated for collectors and enthusiasts.",
  },
  {
    emoji: "🛡️",
    iconBg: "bg-secondary/15",
    title: "100% Authentic",
    desc: "Every product is directly sourced and verified. Unboxing proof, genuine warranties, and transparent policies — authenticity is our commitment.",
  },
]

const TAGS = ["Direct Importer", "Wholesaler", "Retailer", "Pan-India"]

export default function AboutUs() {
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Left — intro */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            About Little Stepz
          </p>
          <h2 className="font-anton mt-3 text-3xl sm:text-4xl leading-tight text-text">
            India&apos;s Premier RC &amp;{" "}
            <span className="text-primary">Diecast Destination</span>
          </h2>

          <div className="mt-5 space-y-4 text-sm sm:text-[15px] leading-relaxed text-muted">
            <p>
              Born in 2025 from a deep passion for RC cars, diecast collectibles, and
              racing culture, Little Stepz was created to bring India its finest selection
              of premium hobby-grade vehicles and rare collectibles.
            </p>
            <p>
              As a direct importer, wholesaler, and retailer, we source officially licensed
              RC cars — Ferrari, Bugatti, Mercedes-Benz, Lamborghini, McLaren — alongside
              premium 1:12 scale diecast models, rock crawlers, and limited-edition collectibles.
            </p>
            <p>
              Every product is 100% authentic, warranty-backed, and shipped across 500+ cities
              in India. From hobbyists to collectors, Little Stepz is your trusted partner for
              premium automotive toys and collectibles.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {TAGS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right — feature cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md hover:border-primary/15"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${f.iconBg}`}>
                {f.emoji}
              </div>
              <h3 className="font-manrope mt-3 text-sm font-bold text-text">{f.title}</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
