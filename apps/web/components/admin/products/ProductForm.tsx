"use client"

import { useEffect, useState } from "react"
import slugify from "slugify"
import { useRouter } from "next/navigation"
import { Input, Button } from "@repo/ui/index"
import { createProductSchema } from "@repo/zod-schema/index"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import ProductImageManager from "./ProductImageManager"
import CategoryTreeSelect from "../categories/CategoryTreeSelect"
import VariantManager from "./VariantManager"

interface Props {
  mode?: "create" | "edit"
  initialData?: any
}

export default function ProductForm({ mode = "create", initialData }: Props) {
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
  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm(initialData)
      setImages(initialData.images || [])
      setProductId(initialData.id)
    }
  }, [initialData])

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

    setLoading(true)

    try {
      if (mode === "edit") {
        await AdminProductService.updateProduct(productId!, parsed.data)
      } else {
        const product = await AdminProductService.createProduct(parsed.data)
        setProductId(product.id)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-8 space-y-6">

      <div className="space-y-2">
        <label className="text-md text-gray-500  p-4 ">Product Name</label>
        <Input
          placeholder="Product name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-md text-gray-500  p-4 ">Slug</label>
        <Input
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => onChange("slug", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-md text-gray-500  p-4 ">Description</label>
        <textarea
          className="w-full min-h-[120px] p-4 border rounded-xl"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-md text-gray-500  p-4 ">Price</label>
          <Input
            type="number"
            placeholder="Price"
            value={form.price}
            onChange={(e) => onChange("price", Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-md text-gray-500  p-4 ">Quantity</label>
          <Input
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => onChange("quantity", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-md text-gray-500  p-4 ">Category</label>
        <CategoryTreeSelect
          value={form.categoryId}
          onChange={(id) => onChange("categoryId", id)}
        />
      </div>

      <Button onClick={submit} loading={loading}>
        {mode === "edit" ? "Update Product" : "Add Product"}
      </Button>

      {productId && (
        <>
          <ProductImageManager
            productId={productId}
            images={images}
            onChange={setImages}
          />

          <VariantManager
            productId={productId}
            initialVariants={initialData?.variants || []}
          />

          <Button
            onClick={() => router.push("/admin/products")}
            className="bg-green-600"
          >
            Done
          </Button>
        </>
      )}
    </div>
  )
}