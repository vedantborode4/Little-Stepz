"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { viralReelSchema, VIRAL_REEL_MAX_PRODUCTS } from "@repo/zod-schema/index"
import AdminModal from "../AdminModal"
import { AdminViralReelService, type AdminViralReel, type AdminReelProduct } from "../../../lib/services/admin-viral-reel.service"
import { AdminProductImageService } from "../../../lib/services/admin-product-image.service"
import { ProductService } from "../../../lib/services/product.service"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"

const inputClass =
  "w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-faint">{hint}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}

function ProductPicker({
  selected,
  onChange,
}: {
  selected: AdminReelProduct[]
  onChange: (next: AdminReelProduct[]) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AdminReelProduct[]>([])
  const [searching, setSearching] = useState(false)
  const full = selected.length >= VIRAL_REEL_MAX_PRODUCTS

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await ProductService.getProducts({ search: q, limit: 8 })
        if (cancelled) return
        setResults(res.data.map((p) => ({ id: p.id, name: p.name, slug: p.slug, imageUrl: p.images[0]?.url ?? null })))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  const add = (p: AdminReelProduct) => {
    if (full || selected.some((s) => s.id === p.id)) return
    onChange([...selected, p])
    setQuery("")
    setResults([])
  }

  const move = (i: number, dir: -1 | 1) => {
    const next = [...selected]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="border border-border rounded-xl divide-y divide-border">
          {selected.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <img src={p.imageUrl ?? "/placeholder.webp"} alt="" className="w-9 h-9 rounded-lg object-cover bg-surface-2 shrink-0" />
              <span className="text-sm text-text truncate flex-1">{p.name}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1 text-faint hover:text-text disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label="Move down" className="p-1 text-faint hover:text-text disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => onChange(selected.filter((s) => s.id !== p.id))} aria-label={`Remove ${p.name}`} className="p-1 text-red-500 dark:text-red-400"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products to link…"
            className={`${inputClass} pl-9`}
          />
          {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" />}
          {results.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-auto bg-surface border border-border rounded-xl shadow-lg">
              {results.map((p) => {
                const taken = selected.some((s) => s.id === p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={taken}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-50"
                    >
                      <img src={p.imageUrl ?? "/placeholder.webp"} alt="" className="w-8 h-8 rounded-lg object-cover bg-surface-2 shrink-0" />
                      <span className="text-sm text-text truncate">{p.name}</span>
                      {taken && <span className="ml-auto text-xs text-faint">Added</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  reel: AdminViralReel | null
  onClose: () => void
  onSuccess: () => void
}

export default function ReelFormModal({ reel, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reelUrl, setReelUrl] = useState(reel?.reelUrl ?? "")
  const [coverImageUrl, setCoverImageUrl] = useState(reel?.coverImageUrl ?? "")
  const [caption, setCaption] = useState(reel?.caption ?? "")
  const [products, setProducts] = useState<AdminReelProduct[]>(reel?.products ?? [])
  const [sortOrder, setSortOrder] = useState(reel?.sortOrder ?? 0)
  const [isActive, setIsActive] = useState(reel?.isActive ?? true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const uploadCover = async (file: File) => {
    setUploading(true)
    try {
      const signature = await AdminProductImageService.getSignature("viral-reels")
      const uploaded = await uploadToCloudinary(file, signature)
      if (!uploaded?.secure_url) throw new Error("Upload failed")
      setCoverImageUrl(uploaded.secure_url)
      setErrors((e) => ({ ...e, coverImageUrl: "" }))
    } catch (err: any) {
      toast.error(err?.message || "Cover upload failed")
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    const parsed = viralReelSchema.safeParse({
      reelUrl,
      coverImageUrl,
      caption: caption.trim() || undefined,
      productIds: products.map((p) => p.id),
      sortOrder,
      isActive,
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form")
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }

    setSaving(true)
    try {
      if (reel) await AdminViralReelService.update(reel.id, parsed.data)
      else await AdminViralReelService.create(parsed.data)
      toast.success(reel ? "Reel updated" : "Reel added")
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save reel")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal title={reel ? "Edit Reel" : "Add Reel"} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <Field label="Instagram reel link *" hint="Paste the link from Instagram's Share → Copy link." error={errors.reelUrl}>
          <input
            value={reelUrl}
            onChange={(e) => setReelUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/…"
            className={inputClass}
          />
        </Field>

        <Field label="Cover image *" hint="Portrait 9:16 works best, e.g. a frame from the reel." error={errors.coverImageUrl}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadCover(file)
              e.target.value = ""
            }}
          />
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative w-28 aspect-9/16 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary/40 bg-surface-2 flex items-center justify-center text-faint disabled:opacity-60"
            >
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="Cover preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <ImagePlus size={20} />
              )}
            </button>
            <span className="text-xs text-faint pb-1">
              {uploading ? "Uploading…" : coverImageUrl ? "Click the image to replace it." : "Click to upload."}
            </span>
          </div>
        </Field>

        <Field label="Caption" hint="Optional, shown on the card. Up to 80 characters." error={errors.caption}>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={80}
            placeholder="e.g. 360° flips on any surface"
            className={inputClass}
          />
        </Field>

        <Field
          label={`Products * (${products.length}/${VIRAL_REEL_MAX_PRODUCTS})`}
          hint="The first product is shown on the card."
          error={errors.productIds}
        >
          <ProductPicker selected={products} onChange={(next) => { setProducts(next); setErrors((e) => ({ ...e, productIds: "" })) }} />
        </Field>

        <div className="grid grid-cols-2 gap-4 items-end">
          <Field label="Sort order" hint="Lower shows first.">
            <input
              type="number"
              min={0}
              max={999}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-3 cursor-pointer pb-7">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm font-medium text-muted">Show on home page</span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted hover:bg-surface-2 transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || uploading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition"
          >
            {saving ? "Saving…" : reel ? "Save Reel" : "Add Reel"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
