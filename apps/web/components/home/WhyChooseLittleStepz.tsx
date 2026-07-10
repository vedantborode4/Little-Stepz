import Reveal from "../common/Reveal"

type Advantage = {
  icon: string
  title: string
  description: string
  iconBg: string
}

const ADVANTAGES: Advantage[] = [
  {
    icon: "🌍",
    title: "Directly Imported",
    description:
      "Sourced from verified global suppliers in China, Japan, USA and Europe. Authentic products, not counterfeits.",
    iconBg: "bg-blue-50 dark:bg-blue-500/15",
  },
  {
    icon: "🛡️",
    title: "Premium Quality",
    description:
      "Every product passes our quality check before it reaches you. We never compromise on standards or authenticity.",
    iconBg: "bg-indigo-50 dark:bg-indigo-500/15",
  },
  {
    icon: "🚚",
    title: "Pan-India Delivery",
    description:
      "Fast, reliable shipping to 500+ cities across all 28 states and 8 union territories of India.",
    iconBg: "bg-green-50 dark:bg-green-500/15",
  },
  {
    icon: "🏪",
    title: "Wholesale & Retail",
    description:
      "We serve both B2B and B2C buyers across India — whether you're stocking a store or buying a gift.",
    iconBg: "bg-purple-50 dark:bg-purple-500/15",
  },
  {
    icon: "📦",
    title: "12 Toys Categories",
    description:
      "RC Cars, Die Cast, Building Blocks, Anime Figures and Educational Toys — curated all in one place.",
    iconBg: "bg-teal-50 dark:bg-teal-500/15",
  },
  {
    icon: "💬",
    title: "Dedicated Support",
    description:
      "Our team assists with product selection, bulk orders, custom sourcing and after-sales queries.",
    iconBg: "bg-rose-50 dark:bg-rose-500/15",
  },
]

export default function WhyChooseLittleStepz() {
  return (
    <section className="bg-bg py-12 sm:py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-primary text-xs sm:text-sm font-bold uppercase tracking-[0.2em]">
            Our Advantage
          </p>
          <h2 className="font-anton mt-2 text-3xl sm:text-4xl uppercase tracking-wide text-text">
            Why Choose Little Stepz
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-muted leading-relaxed">
            We&apos;re not just a reseller — we&apos;re a direct importer committed to
            quality, authenticity and service.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ADVANTAGES.map((a, i) => (
            <Reveal key={a.title} delay={i * 90} className="h-full">
              <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:bg-primary/5 hover:border-primary/15 hover:shadow-md">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${a.iconBg}`}
                >
                  {a.icon}
                </div>

                <h3 className="font-manrope mt-4 text-lg font-bold text-text">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {a.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
