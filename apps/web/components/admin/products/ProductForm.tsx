"use client"

import { useState } from "react"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import { useRouter } from "next/navigation"
import slugify from "slugify"
import CategoryTreeSelect from "../categories/CategoryTreeSelect"

export default function ProductForm() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    quantity: 0,
    inStock: true,
    categoryId: "",
  })

  const [loading, setLoading] = useState(false)

  const onChange = (key: string, value: any) => {
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && { slug: slugify(value, { lower: true }) }),
    }))
  }

  const submit = async () => {
    if (!form.categoryId) {
      alert("Please select a category")
      return
    }

    setLoading(true)

    try {
      await AdminProductService.createProduct(form)
      router.push("/admin/products")
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed")
    }

    setLoading(false)
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5 max-w-2xl">

      <h2 className="text-lg font-semibold">Create Product</h2>

      <input
        placeholder="Product name"
        className="input"
        value={form.name}
        onChange={(e) => onChange("name", e.target.value)}
      />

      <input
        placeholder="Slug"
        className="input"
        value={form.slug}
        onChange={(e) => onChange("slug", e.target.value)}
      />

      <textarea
        placeholder="Description"
        className="input"
        value={form.description}
        onChange={(e) => onChange("description", e.target.value)}
      />

      <input
        type="number"
        placeholder="Price"
        className="input"
        value={form.price}
        onChange={(e) => onChange("price", Number(e.target.value))}
      />

      <input
        type="number"
        placeholder="Quantity"
        className="input"
        value={form.quantity}
        onChange={(e) => onChange("quantity", Number(e.target.value))}
      />

      {/* ✅ STOCK TOGGLE */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.inStock}
          onChange={(e) => onChange("inStock", e.target.checked)}
        />
        In stock
      </label>

      {/* ✅ TREE CATEGORY SELECTOR */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Category</p>

        <CategoryTreeSelect
          value={form.categoryId}
          onChange={(id) => onChange("categoryId", id)}
        />
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="bg-primary text-white px-6 py-2 rounded-lg w-full"
      >
        {loading ? "Creating..." : "Create Product"}
      </button>

    </div>
  )
}