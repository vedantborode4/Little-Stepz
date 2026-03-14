import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"

export function HeadingFor() {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex flex-col md:flex-row">

        {/* Left — accent block */}
        <div className="bg-primary/5 border-r border-gray-200 md:w-1/2 px-8 py-12 flex flex-col justify-center space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles size={13} className="text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Our Promise</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl md:text-4xl font-bold text-primary leading-tight">
              Made for Little Hands
            </h2>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Made for Big Fun
            </h2>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition w-fit shadow-sm mt-2"
          >
            Shop Now <ArrowRight size={14} />
          </Link>
        </div>

        {/* Right — description + trust badges */}
        <div className="md:w-1/2 px-8 py-12 flex flex-col justify-center space-y-6">
          <p className="text-gray-600 text-sm leading-relaxed">
            Little Stepz creates safe, fun, and thoughtfully designed toys that
            help children learn through play. Every product supports early
            development, creativity, and joyful milestones — because every big
            journey begins with little steps.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Safe & Tested", desc: "All toys are child-safe certified" },
              { label: "Age Appropriate", desc: "Designed for each growth stage" },
              { label: "Skill Building", desc: "Supports cognitive development" },
              { label: "Joyful Play", desc: "Fun that sparks imagination" },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}