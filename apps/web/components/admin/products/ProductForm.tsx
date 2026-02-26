"use client"

import { useState } from "react"
import slugify from "slugify"
import { useRouter } from "next/navigation"

import { Input, Button } from "@repo/ui/index"
import { createProductSchema } from "@repo/zod-schema/index"

import { AdminProductService } from "../../../lib/services/admin-product.service"
import ProductImageManager from "./ProductImageManager"
import CategoryTreeSelect from "../categories/CategoryTreeSelect"

export default function ProductForm() {
  const router = useRouter()

  const [productId, setProductId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    quantity: 0,
    inStock: true,
    categoryId: "",
  })

  const [images, setImages] = useState<any[]>([])

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  const onChange = (key: string, value: any) => {
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && {
        slug: slugify(value, { lower: true, strict: true }),
      }),
    }))
  }

  const submit = async () => {
    const parsed = createProductSchema.safeParse(form)

    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const product = await AdminProductService.createProduct(parsed.data)

      setProductId(product.id)
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to create product")
    }

    setLoading(false)
  }

  return (
    <div className="bg-white border rounded-xl p-8 max-w-4xl space-y-6">

      <h2 className="text-lg font-semibold">Add Product</h2>

      <div>
        <Input
          placeholder="Product name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
        {errors.name && (
          <p className="text-red-500 text-sm">{errors.name[0]}</p>
        )}
      </div>

      <div>
        <Input
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => onChange("slug", e.target.value)}
        />
        {errors.slug && (
          <p className="text-red-500 text-sm">{errors.slug[0]}</p>
        )}
      </div>

      <div>
        <textarea
          placeholder="Short Information"
          className="w-full min-h-[120px] p-4 rounded-xl border border-border"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
        {errors.description && (
          <p className="text-red-500 text-sm">
            {errors.description[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="number"
            placeholder="Regular Price"
            onChange={(e) => onChange("price", Number(e.target.value))}
          />
          {errors.price && (
            <p className="text-red-500 text-sm">{errors.price[0]}</p>
          )}
        </div>

        <div>
          <Input
            type="number"
            placeholder="Quantity"
            onChange={(e) => onChange("quantity", Number(e.target.value))}
          />
          {errors.quantity && (
            <p className="text-red-500 text-sm">
              {errors.quantity[0]}
            </p>
          )}
        </div>
      </div>

      <div>
        <CategoryTreeSelect
          value={form.categoryId}
          onChange={(id) => onChange("categoryId", id)}
        />
        {errors.categoryId && (
          <p className="text-red-500 text-sm">
            {errors.categoryId[0]}
          </p>
        )}
      </div>


      {!productId && (
        <Button onClick={submit} loading={loading}>
          Add Product
        </Button>
      )}

      // IMAGE MANAGER AFTER CREATE 

      {productId && (
        <div className="space-y-4">

          <h3 className="font-semibold">Upload Images</h3>

          <ProductImageManager
            productId={productId}
            images={images}
            onChange={setImages}
          />

          <Button
            onClick={() => router.push("/admin/products")}
            className="bg-green-600"
          >
            Done
          </Button>

        </div>
      )}

    </div>
  )
}