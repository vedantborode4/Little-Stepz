"use client"

import { useEffect, useState } from "react"
import { Input, Button } from "@repo/ui/index"
import {
  createVariantBodySchema,
  updateVariantBodySchema,
} from "@repo/zod-schema/index"
import { AdminProductService } from "../../../lib/services/admin-product.service"

interface Variant {
  id: string
  name: string
  price?: number | null
  salePrice?: number | null
  isOnSale?: boolean
  stock?: number
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

  useEffect(() => {
    setVariants(initialVariants)
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
      setErrors(parsed.error.flatten().fieldErrors)
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
    } finally {
      setLoading(false)
    }
  }

  const updateVariant = async (id: string, key: string, value: any) => {
    const updated = variants.map((v) =>
      v.id === id ? { ...v, [key]: value } : v
    )
    setVariants(updated)

    const current = updated.find((v) => v.id === id)!
    const payload: Record<string, any> = {}
    if (key === "name") payload.name = value
    else if (key === "isOnSale") {
      payload.isOnSale = value
      // Include the existing sale price so the "on sale needs a sale price" rule can pass.
      if (current.salePrice != null && current.salePrice !== ("" as any)) payload.salePrice = Number(current.salePrice)
    } else {
      payload[key] = Number(value)
    }

    const parsed = updateVariantBodySchema.safeParse(payload)
    if (!parsed.success) return

    await AdminProductService.updateVariant(id, parsed.data)
    onChange?.()
  }

  const removeVariant = async (id: string) => {
    await AdminProductService.deleteVariant(id)
    setVariants((p) => p.filter((v) => v.id !== id))
    onChange?.()
  }

  return (
    <div className="bg-white rounded-xl p-2 space-y-6">

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

      {variants.map((v) => (
        <div key={v.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
          <Input
            value={v.name}
            onChange={(e) => updateVariant(v.id, "name", e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Regular price"
            value={v.price ?? ""}
            onChange={(e) => { if (numericGuard(e.target.value)) updateVariant(v.id, "price", e.target.value) }}
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Sale price"
            value={v.salePrice ?? ""}
            onChange={(e) => { if (numericGuard(e.target.value)) updateVariant(v.id, "salePrice", e.target.value) }}
          />
          <Input
            type="number"
            value={v.stock || ""}
            onChange={(e) => updateVariant(v.id, "stock", e.target.value)}
          />
          <Button className="bg-red-500" onClick={() => removeVariant(v.id)}>
            Delete
          </Button>
          <label className="col-span-2 sm:col-span-5 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={v.isOnSale ?? false} onChange={(e) => updateVariant(v.id, "isOnSale", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            On sale
          </label>
        </div>
      ))}

      {!variants.length && (
        <p className="text-sm text-muted">No variants created</p>
      )}
    </div>
  )
}
