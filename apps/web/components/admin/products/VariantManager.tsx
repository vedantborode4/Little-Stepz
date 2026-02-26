"use client"

import { useState } from "react"
import { Input, Button } from "@repo/ui/index"
import {
  createVariantBodySchema,
  updateVariantBodySchema,
} from "@repo/zod-schema/index"

import { AdminProductService } from "../../../lib/services/admin-product.service"

interface Props {
  productId: string
}

export default function VariantManager({ productId }: Props) {
  const [variants, setVariants] = useState<any[]>([])
  const [form, setForm] = useState({ name: "", price: "", stock: "" })
  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const resetForm = () =>
    setForm({ name: "", price: "", stock: "" })

  // ➕ CREATE

  const createVariant = async () => {
    const parsed = createVariantBodySchema.safeParse({
      productId,
      name: form.name,
      price: form.price ? Number(form.price) : undefined,
      stock: form.stock ? Number(form.stock) : undefined,
    })

    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setLoading(true)

    try {
      const newVariant = await AdminProductService.createVariant(parsed.data)

      setVariants((p) => [...p, newVariant])
      resetForm()
      setErrors({})
    } catch (e: any) {
      alert(e.response?.data?.message)
    }

    setLoading(false)
  }

  // ✏️ UPDATE

  const updateVariant = async (id: string, key: string, value: any) => {
    const updated = variants.map((v) =>
      v.id === id ? { ...v, [key]: value } : v
    )
    setVariants(updated)

    const parsed = updateVariantBodySchema.safeParse({
      [key]: key === "name" ? value : Number(value),
    })

    if (!parsed.success) return

    await AdminProductService.updateVariant(id, parsed.data)
  }

  // ❌ DELETE

  const removeVariant = async (id: string) => {
    if (!confirm("Delete variant?")) return

    await AdminProductService.deleteVariant(id)
    setVariants((p) => p.filter((v) => v.id !== id))
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-6">

      <h3 className="font-semibold text-lg">Variants</h3>

      {/* CREATE FORM */}

      <div className="grid grid-cols-4 gap-3">

        <div>
          <Input
            placeholder="Variant name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />
          {errors.name && <p className="text-red-500 text-xs">{errors.name[0]}</p>}
        </div>

        <Input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
        />

        <Input
          type="number"
          placeholder="Stock"
          value={form.stock}
          onChange={(e) =>
            setForm({ ...form, stock: e.target.value })
          }
        />

        <Button loading={loading} onClick={createVariant}>
          Add
        </Button>

      </div>

      {/* LIST */}

      <div className="space-y-3">

        {variants.map((v) => (
          <div
            key={v.id}
            className="grid grid-cols-4 gap-3 items-center"
          >

            <Input
              value={v.name}
              onChange={(e) =>
                updateVariant(v.id, "name", e.target.value)
              }
            />

            <Input
              type="number"
              value={v.price || ""}
              onChange={(e) =>
                updateVariant(v.id, "price", e.target.value)
              }
            />

            <Input
              type="number"
              value={v.stock}
              onChange={(e) =>
                updateVariant(v.id, "stock", e.target.value)
              }
            />

            <Button
              className="bg-red-500"
              onClick={() => removeVariant(v.id)}
            >
              Delete
            </Button>

          </div>
        ))}

        {!variants.length && (
          <p className="text-sm text-muted">
            No variants created
          </p>
        )}

      </div>
    </div>
  )
}