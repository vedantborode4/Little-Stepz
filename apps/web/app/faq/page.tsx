"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, HelpCircle } from "lucide-react"

// Shared with app/faq/layout.tsx, which builds the FAQPage JSON-LD from the same
// array — Google requires the structured data to match the visible text.
import { FAQS } from "../../lib/seo/faqs"

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <HelpCircle size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">Frequently Asked Questions</h1>
      </div>

      <ul className="space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i
          return (
            <li
              key={i}
              className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-text">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-faint flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <p className="px-5 pb-4 -mt-1 text-sm text-muted leading-relaxed">{item.a}</p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-8 text-sm text-muted leading-relaxed">
        For the full unboxing requirements, please read our{" "}
        <Link href="/unboxing-policy" className="text-primary font-medium hover:underline">
          Unboxing Policy
        </Link>
        .
      </p>
    </div>
  )
}
