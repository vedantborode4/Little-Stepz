"use client"

import { useEffect, useRef, useState } from "react"
import {
  createVariantBodySchema,
  updateVariantBodySchema,
} from "@repo/zod-schema/index"
import {
  AdminProductService,
  type ProductVariant,
  type VariantBody,
} from "../../../lib/services/admin-product.service"
import { getApiError, firstFieldError } from "../../../lib/errors"
import ProductImageManager from "./ProductImageManager"
import VariantRow, { type VariantFormValue } from "./VariantRow"
import AdminModal from "../AdminModal"
import { ImageIcon, Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"

interface Props {
  productId: string
  initialVariants?: ProductVariant[]
  onChange?: () => void
}

interface EditableVariant extends VariantFormValue {
  id: string
  sortOrder: number
  images: any[]
}

const emptyForm = (): VariantFormValue => ({
  name: "", sku: "", price: "", salePrice: "", isOnSale: false, stock: "",
})

const toEditable = (v: ProductVariant, index: number): EditableVariant => ({
  id: v.id,
  name: v.name ?? "",
  sku: v.sku ?? "",
  price: v.price != null ? String(v.price) : "",
  salePrice: v.salePrice != null ? String(v.salePrice) : "",
  isOnSale: v.isOnSale ?? false,
  stock: v.stock != null ? String(v.stock) : "",
  sortOrder: v.sortOrder ?? index,
  images: v.images ?? [],
})

const buildBody = (v: VariantFormValue): VariantBody => ({
  name: v.name.trim(),
  sku: v.sku.trim() ? v.sku.trim() : null,
  price: v.price === "" ? null : Number(v.price),
  salePrice: v.salePrice === "" ? null : Number(v.salePrice),
  isOnSale: v.isOnSale,
  stock: v.stock === "" ? 0 : Number(v.stock),
})

export default function VariantManager({ productId, initialVariants = [], onChange }: Props) {
  const [variants, setVariants] = useState<EditableVariant[]>([])
  const [drafts, setDrafts] = useState<VariantFormValue[]>([])
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Seed local state only when the product itself changes — never on every
  // parent re-render, so in-progress edits aren't silently wiped.
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (seededFor.current === productId) return
    seededFor.current = productId
    setVariants(initialVariants.map(toEditable))
    setDrafts([])
    setDirtyIds(new Set())
  }, [productId, initialVariants])

  const hasUnsaved = dirtyIds.size > 0 || drafts.length > 0
  useEffect(() => {
    if (!hasUnsaved) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsaved])

  const markDirty = (id: string) => setDirtyIds((s) => new Set(s).add(id))
  const clearDirty = (id: string) =>
    setDirtyIds((s) => { const n = new Set(s); n.delete(id); return n })

  // ── Drafts (batch add) ──────────────────────────────────────────────────
  const addDraft = () => setDrafts((d) => [...d, emptyForm()])
  const updateDraft = (i: number, patch: Partial<VariantFormValue>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const removeDraft = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i))

  const saveAllDrafts = async () => {
    // Validate every draft up front so nothing is half-saved on a typo.
    for (let i = 0; i < drafts.length; i++) {
      const parsed = createVariantBodySchema.safeParse({ productId, ...buildBody(drafts[i]!) })
      if (!parsed.success) {
        toast.error(`Row ${i + 1}: ${firstFieldError(parsed.error.flatten().fieldErrors) || "invalid"}`)
        return
      }
    }

    setSavingAll(true)
    const results = await Promise.allSettled(
      drafts.map((d) => AdminProductService.createVariant(productId, buildBody(d)))
    )
    const created: EditableVariant[] = []
    const failedDrafts: VariantFormValue[] = []
    results.forEach((r, i) => {
      if (r.status === "fulfilled") created.push(toEditable(r.value, variants.length + created.length))
      else failedDrafts.push(drafts[i]!)
    })
    if (created.length) setVariants((v) => [...v, ...created])
    setDrafts(failedDrafts)
    setSavingAll(false)

    if (failedDrafts.length === 0) toast.success(`${created.length} variant${created.length !== 1 ? "s" : ""} added`)
    else toast.error(`${created.length} saved, ${failedDrafts.length} failed — check the remaining rows`)
    onChange?.()
  }

  // ── Existing variants ───────────────────────────────────────────────────
  const editVariant = (id: string, patch: Partial<VariantFormValue>) => {
    setVariants((v) => v.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    markDirty(id)
  }

  const saveVariant = async (v: EditableVariant) => {
    const parsed = updateVariantBodySchema.safeParse(buildBody(v))
    if (!parsed.success) {
      toast.error(firstFieldError(parsed.error.flatten().fieldErrors) || "Please check the variant fields")
      return
    }
    setSavingId(v.id)
    try {
      const saved = await AdminProductService.updateVariant(v.id, buildBody(v))
      setVariants((list) => list.map((row) => (row.id === v.id ? { ...toEditable(saved, 0), sortOrder: row.sortOrder, images: row.images } : row)))
      clearDirty(v.id)
      toast.success("Variant saved")
      onChange?.()
    } catch (e: any) {
      toast.error(getApiError(e, "Failed to save variant").message)
    } finally {
      setSavingId(null)
    }
  }

  const doDelete = async () => {
    if (!deleteId) return
    try {
      await AdminProductService.deleteVariant(deleteId)
      setVariants((v) => v.filter((row) => row.id !== deleteId))
      clearDirty(deleteId)
      toast.success("Variant deleted")
      onChange?.()
    } catch (e: any) {
      toast.error(getApiError(e, "Failed to delete variant").message)
    } finally {
      setDeleteId(null)
    }
  }

  // Renumber all sortOrders to array position and persist the ones that changed.
  const move = async (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= variants.length) return
    const next = [...variants]
    const moved = next.splice(index, 1)[0]!
    next.splice(to, 0, moved)
    const renumbered = next.map((v, i) => ({ ...v, sortOrder: i }))
    const changed = renumbered.filter((v) => variants.find((o) => o.id === v.id)?.sortOrder !== v.sortOrder)
    setVariants(renumbered)
    await Promise.allSettled(changed.map((v) => AdminProductService.updateVariant(v.id, { sortOrder: v.sortOrder })))
  }


  return (
    <div className="space-y-6">
      {/* Existing variants */}
      {variants.map((v, i) => {
        const dirty = dirtyIds.has(v.id)
        return (
          <div key={v.id} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col pt-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="p-1 text-faint hover:text-muted disabled:opacity-30" aria-label="Move up">
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === variants.length - 1}
                  className="p-1 text-faint hover:text-muted disabled:opacity-30" aria-label="Move down">
                  <ArrowDown size={15} />
                </button>
              </div>
              <div className="flex-1">
                <VariantRow value={v} onChange={(patch) => editVariant(v.id, patch)} disabled={savingId === v.id} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pl-9">
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === v.id ? null : v.id))}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ImageIcon size={15} />
                {v.images?.length ? `Images (${v.images.length})` : "Add images"}
              </button>

              <div className="ml-auto flex items-center gap-3">
                {dirty && <span className="text-xs font-medium text-amber-500 dark:text-amber-400">Unsaved</span>}
                <button
                  type="button"
                  onClick={() => saveVariant(v)}
                  disabled={!dirty || savingId === v.id}
                  className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingId === v.id && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(v.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/15 transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === v.id && (
              <div className="pl-9">
                <ProductImageManager
                  productId={productId}
                  variantId={v.id}
                  images={v.images ?? []}
                  onChange={(imgs) => setVariants((list) => list.map((row) => (row.id === v.id ? { ...row, images: imgs } : row)))}
                />
              </div>
            )}
          </div>
        )
      })}

      {!variants.length && !drafts.length && (
        <p className="text-sm text-faint">No variants yet. Add one or more below.</p>
      )}

      {/* Draft rows (batch add) */}
      {drafts.length > 0 && (
        <div className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium text-muted">New variants</p>
          {drafts.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <VariantRow value={d} onChange={(patch) => updateDraft(i, patch)} disabled={savingAll} />
              </div>
              <button type="button" onClick={() => removeDraft(i)} disabled={savingAll}
                className="p-2 text-faint hover:text-red-500" aria-label="Remove row">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={saveAllDrafts}
            disabled={savingAll}
            className="inline-flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {savingAll && <Loader2 size={14} className="animate-spin" />}
            Save all new variants
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={addDraft}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80"
      >
        <Plus size={15} /> Add variant
      </button>

      {deleteId && (
        <AdminModal title="Delete Variant?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-muted mb-5">
            This permanently removes the variant and its images. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted">Cancel</button>
            <button onClick={doDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
