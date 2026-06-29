"use client"

import { useEffect, useState } from "react"
import { Input, Button } from "@repo/ui/index"
import {
  createVariantBodySchema,
  updateVariantBodySchema,
} from "@repo/zod-schema/index"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import { getApiError, firstFieldError } from "../../../lib/errors"
import ProductImageManager from "./ProductImageManager"
import { ImageIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Variant {
  id: string
  name: string
  price?: number | string | null
  salePrice?: number | string | null
  isOnSale?: boolean
  stock?: number | string
  images?: any[]
}

interface Props {
  productId: string
  initialVariants?: Variant[]
  onChange?: () => void
}

const numericGuard = (v: string) => v === "" || /^\d*\.?\d{0,2}$/.test(v)

export default function VariantManager({
  productId,
  initialVariants = [],
  onChange,
}: Props) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants)
  const [form, setForm] = useState({ name: "", price: "", salePrice: "", isOnSale: false, stock: "" })
  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const updateVariantImages = (variantId: string, images: any[]) => {
    setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, images } : v)))
  }

  useEffect(() => {
    setVariants(initialVariants)
    setDirtyIds(new Set())
  }, [initialVariants])

  const createVariant = async () => {
    const parsed = createVariantBodySchema.safeParse({
      productId,
      name: form.name,
      price: form.price ? Number(form.price) : undefined,
      salePrice: form.salePrice ? Number(form.salePrice) : undefined,
      isOnSale: form.isOnSale,
      stock: form.stock ? Number(form.stock) : undefined,
    })

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors(fieldErrors)
      console.error("[VariantManager] validation failed:", fieldErrors)
      toast.error(firstFieldError(fieldErrors) || "Please check the variant fields")
      return
    }

    setLoading(true)

    try {
      const { productId: _pid, ...variantBody } = parsed.data as any
      const newVariant = await AdminProductService.createVariant(productId, variantBody)
      setVariants((p) => [...p, newVariant])
      setForm({ name: "", price: "", salePrice: "", isOnSale: false, stock: "" })
      setErrors({})
      onChange?.()
    } catch (e: any) {
      console.error("[VariantManager] create failed:", e?.response?.data ?? e)
      toast.error(getApiError(e, "Failed to add variant").message)
    } finally {
      setLoading(false)
    }
  }

  // Local edit only — persisted when the row's Save button is clicked.
  const editVariant = (id: string, key: string, value: any) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [key]: value } : v)))
    setDirtyIds((prev) => new Set(prev).add(id))
  }

  const saveVariant = async (v: Variant) => {
    const payload: Record<string, any> = { name: v.name, isOnSale: v.isOnSale ?? false }
    if (v.price !== "" && v.price != null) payload.price = Number(v.price)
    if (v.salePrice !== "" && v.salePrice != null) payload.salePrice = Number(v.salePrice)
    if (v.stock !== "" && v.stock != null) payload.stock = Number(v.stock)

    const parsed = updateVariantBodySchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      console.error("[VariantManager] validation failed:", fieldErrors)
      toast.error(firstFieldError(fieldErrors) || "Please check the variant fields")
      return
    }

    setSavingId(v.id)
    try {
      await AdminProductService.updateVariant(v.id, parsed.data)
      setDirtyIds((prev) => {
        const next = new Set(prev)
        next.delete(v.id)
        return next
      })
      toast.success("Variant saved")
      onChange?.()
    } catch (e: any) {
      console.error("[VariantManager] save failed:", e?.response?.data ?? e)
      toast.error(getApiError(e, "Failed to save variant").message)
    } finally {
      setSavingId(null)
    }
  }

  const removeVariant = async (id: string) => {
    try {
      await AdminProductService.deleteVariant(id)
      setVariants((p) => p.filter((v) => v.id !== id))
      setDirtyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      onChange?.()
    } catch (e: any) {
      console.error("[VariantManager] delete failed:", e?.response?.data ?? e)
      toast.error(getApiError(e, "Failed to delete variant").message)
    }
  }

  return (
    <div className="bg-white rounded-xl p-2 space-y-6">

      {/* Add new variant */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
        <Input
          placeholder="Variant name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Regular price"
          value={form.price}
          onChange={(e) => { if (numericGuard(e.target.value)) setForm({ ...form, price: e.target.value }) }}
        />
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Sale price"
          value={form.salePrice}
          onChange={(e) => { if (numericGuard(e.target.value)) setForm({ ...form, salePrice: e.target.value }) }}
        />
        <Input
          type="number"
          placeholder="Stock"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <Button loading={loading} onClick={createVariant}>
          Add
        </Button>
        <label className="col-span-2 sm:col-span-5 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isOnSale} onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
          On sale — charge this variant&apos;s sale price
        </label>
      </div>
      {(errors.salePrice?.[0] || errors.price?.[0]) && (
        <p className="text-xs text-red-500">{errors.salePrice?.[0] || errors.price?.[0]}</p>
      )}

      {/* Existing variants — each saved explicitly */}
      {variants.map((v) => {
        const dirty = dirtyIds.has(v.id)
        return (
          <div key={v.id} className="rounded-xl border border-gray-100 p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
              <Input
                value={v.name}
                onChange={(e) => editVariant(v.id, "name", e.target.value)}
              />
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Regular price"
                value={v.price ?? ""}
                onChange={(e) => { if (numericGuard(e.target.value)) editVariant(v.id, "price", e.target.value) }}
              />
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Sale price"
                value={v.salePrice ?? ""}
                onChange={(e) => { if (numericGuard(e.target.value)) editVariant(v.id, "salePrice", e.target.value) }}
              />
              <Input
                type="number"
                placeholder="Stock"
                value={v.stock ?? ""}
                onChange={(e) => editVariant(v.id, "stock", e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={v.isOnSale ?? false} onChange={(e) => editVariant(v.id, "isOnSale", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                On sale
              </label>
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === v.id ? null : v.id))}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ImageIcon size={15} />
                {v.images?.length ? `Images (${v.images.length})` : "Add images"}
              </button>

              <div className="ml-auto flex items-center gap-3">
                {dirty && <span className="text-xs font-medium text-amber-500">Unsaved changes</span>}
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
                  onClick={() => removeVariant(v.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
            {expandedId === v.id && (
              <ProductImageManager
                productId={productId}
                variantId={v.id}
                images={v.images ?? []}
                onChange={(imgs) => updateVariantImages(v.id, imgs)}
              />
            )}
          </div>
        )
      })}

      {!variants.length && (
        <p className="text-sm text-muted">No variants created</p>
      )}
    </div>
  )
}
