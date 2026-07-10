"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, HelpCircle } from "lucide-react"

const FAQS = [
  {
    q: "Do you offer Cash on Delivery (COD)?",
    a: "Yes, COD may be available for selected products and locations. Some COD orders may require advance confirmation fee.",
  },
  {
    q: "Why do you ask for advance payment for COD?",
    a: "To prevent fake or abandoned orders and ensure genuine customer confirmation.",
  },
  {
    q: "How long does shipping take?",
    a: "Delivery usually takes 2–7 business days depending on location.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, only before dispatch. Once shipped, cancellation may not be possible.",
  },
  {
    q: "Do you accept returns?",
    a: "Yes, only for eligible damaged / defective / incorrect products as per policy.",
  },
  {
    q: "Is unboxing video mandatory?",
    a: "Yes. Full uninterrupted unboxing video is mandatory for any damage, missing item, or return claim.",
  },
  {
    q: "Do you provide warranty?",
    a: "Eligible electronics may have limited warranty against manufacturing defects.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI, Debit/Credit Cards, Net Banking, Wallets, and COD (where available).",
  },
  {
    q: "Do you offer international shipping?",
    a: "Currently depends on operational availability.",
  },
  {
    q: "What if my product arrives damaged?",
    a: "Contact support within 48 hours with mandatory unboxing proof.",
  },
  {
    q: "Can I return a product if I change my mind?",
    a: "No. Change-of-mind returns are not accepted.",
  },
  {
    q: "What if I entered wrong address?",
    a: "Contact support immediately before dispatch. Re-shipping charges may apply if delivery fails.",
  },
]

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
