"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Instagram, Play, ShoppingBag, X } from "lucide-react"
import SectionHeader from "./SectionHeader"
import PriceTag from "../products/PriceTag"
import { cldFill } from "../../lib/utils/cloudinaryUrl"
import { formatINR, getDisplayPrices, getPriceRange } from "../../lib/pricing"
import type { Product } from "../../types/product"
import type { ViralReel } from "../../types/viral-reel"

const ACTION =
  "flex items-center justify-center gap-2 rounded-full py-2.5 px-3 text-xs sm:text-sm font-semibold shadow-lg transition active:scale-95"

function ProductPrice({ product, className = "" }: { product: Product; className?: string }) {
  const variants = product.variants ?? []
  const range = getPriceRange(product, variants)
  if (variants.length > 0 && !range.single) {
    return <p className={`font-manrope text-primary font-semibold text-sm sm:text-base ${className}`}>From {formatINR(range.min)}</p>
  }
  return <PriceTag prices={getDisplayPrices(product)} className={className} />
}

function ProductChooser({ reel, onClose }: { reel: ViralReel; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viral-chooser-title"
        className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 id="viral-chooser-title" className="text-base font-semibold text-text">Products in this reel</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>
        <ul className="overflow-y-auto divide-y divide-border">
          {reel.products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition">
                <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-surface-2">
                  <Image src={cldFill(p.images?.[0]?.url || "/placeholder.webp", 160)} alt="" fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text line-clamp-2">{p.name}</p>
                  <ProductPrice product={p} className="mt-0.5" />
                </div>
                <ChevronRight size={16} className="text-faint shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ReelCard({
  reel,
  open,
  onToggle,
  onChooseProduct,
}: {
  reel: ViralReel
  open: boolean
  onToggle: () => void
  onChooseProduct: () => void
}) {
  const first = reel.products[0]!
  const many = reel.products.length > 1
  const label = reel.caption || first.name
  const productHref = `/products/${first.slug}`

  const viewProductClass = `${ACTION} bg-surface text-text hover:bg-surface-2`
  const viewProduct = many ? (
    <button type="button" onClick={onChooseProduct} className={viewProductClass}>
      <ShoppingBag size={16} /> View products
    </button>
  ) : (
    <Link href={productHref} className={viewProductClass}>
      <ShoppingBag size={16} /> View product
    </Link>
  )

  const stripClass = "flex items-center gap-2.5 p-2.5 sm:p-3 text-left w-full hover:bg-surface-2 transition"
  const stripContent = (
    <>
      <div className="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-surface-2">
        <Image src={cldFill(first.images?.[0]?.url || "/placeholder.webp", 120)} alt="" fill sizes="44px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-text line-clamp-1">{first.name}</p>
        <div className="flex items-center gap-2">
          <ProductPrice product={first} />
          {many && <span className="text-[11px] text-faint whitespace-nowrap">+{reel.products.length - 1} more</span>}
        </div>
      </div>
    </>
  )

  return (
    <div className="group h-full flex flex-col bg-surface rounded-xl border border-border shadow-card overflow-hidden">
      <div className="relative aspect-9/16 bg-surface-2 overflow-hidden">
        <Image
          src={reel.coverImageUrl}
          alt={label}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`Options for reel: ${label}`}
          className="absolute inset-0 z-0 cursor-pointer"
        />

        <span className="pointer-events-none absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center">
          <Play size={16} fill="currentColor" className="ml-0.5" />
        </span>

        {reel.caption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pt-10 pb-3">
            <p className="text-white text-xs sm:text-sm font-medium line-clamp-2">{reel.caption}</p>
          </div>
        )}

        {/* Actions: hover on pointer devices, tap to reveal on touch. Tailwind v4 only
            applies `hover:` on hover-capable devices, so a tap never half-triggers them. */}
        <div
          className={`absolute inset-0 z-10 flex flex-col items-stretch justify-center gap-2.5 px-4 bg-black/55 transition-opacity duration-200 ${
            open
              ? "opacity-100"
              : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto"
          }`}
          onClick={(e) => { if (e.target === e.currentTarget) onToggle() }}
        >
          <a href={reel.reelUrl} target="_blank" rel="noopener noreferrer" className={`${ACTION} bg-primary text-white hover:bg-primary/90`}>
            <Instagram size={16} /> Watch reel
          </a>
          {viewProduct}
        </div>
      </div>

      {many ? (
        <button type="button" onClick={onChooseProduct} className={stripClass}>{stripContent}</button>
      ) : (
        <Link href={productHref} className={stripClass}>{stripContent}</Link>
      )}
    </div>
  )
}

export default function ViralProducts({ reels }: { reels: ViralReel[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [chooser, setChooser] = useState<ViralReel | null>(null)

  useEffect(() => {
    if (!openId) return
    const close = (e: PointerEvent) => {
      const card = sectionRef.current?.querySelector(`[data-reel="${openId}"]`)
      if (card && !card.contains(e.target as Node)) setOpenId(null)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [openId])

  if (reels.length === 0) return null

  const scrollByView = (dir: 1 | -1) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  const arrow =
    "hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-surface shadow-lg border border-border text-muted hover:text-primary hover:border-primary/30 opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 transition"

  return (
    <section ref={sectionRef}>
      <SectionHeader title="Viral Products" subtitle="As seen on our Instagram" />
      <div className="relative group/slider">
        {/* Auto margins centre a short row but collapse to 0 once it overflows, so scrolling is unaffected. */}
        <div
          ref={trackRef}
          className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-2 *:first:ms-auto *:last:me-auto"
        >
          {reels.map((reel) => (
            <div
              key={reel.id}
              data-reel={reel.id}
              className="shrink-0 snap-start basis-[calc(50%-6px)] sm:basis-[calc(33.333%-13.333px)] lg:basis-[calc(25%-15px)]"
            >
              <ReelCard
                reel={reel}
                open={openId === reel.id}
                onToggle={() => setOpenId((cur) => (cur === reel.id ? null : reel.id))}
                onChooseProduct={() => { setOpenId(null); setChooser(reel) }}
              />
            </div>
          ))}
        </div>
        {reels.length > 4 && (
          <>
            <button type="button" aria-label="Previous reels" onClick={() => scrollByView(-1)} className={`${arrow} -left-4`}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Next reels" onClick={() => scrollByView(1)} className={`${arrow} -right-4`}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      {chooser && <ProductChooser reel={chooser} onClose={() => setChooser(null)} />}
    </section>
  )
}
