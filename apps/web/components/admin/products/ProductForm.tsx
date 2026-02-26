"use client"

import { useEffect, useState } from "react"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import { useRouter } from "next/navigation"
import slugify from "slugify"
import { useCategoryStore } from "../../../store/useCategoryStore"

export default function ProductForm() {
  const router = useRouter()

  const { flatCategories, fetchFlatCategories } = useCategoryStore()

    useEffect(() => {
    fetchFlatCategories()
    }, [])

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

  useEffect(() => {
    fetchFlatCategories()
  }, [])

  const onChange = (key: string, value: any) => {
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && { slug: slugify(value, { lower: true }) }),
    }))
  }

  const submit = async () => {
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
    <div className="bg-white border rounded-xl p-6 space-y-4 max-w-2xl">

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
        onChange={(e) => onChange("description", e.target.value)}
      />

      <input
        type="number"
        placeholder="Price"
        className="input"
        onChange={(e) => onChange("price", Number(e.target.value))}
      />

      <input
        type="number"
        placeholder="Quantity"
        className="input"
        onChange={(e) => onChange("quantity", Number(e.target.value))}
      />

      <select
        className="input"
        onChange={(e) => onChange("categoryId", e.target.value)}
      >
        <option value="">Select category</option>
        {flatCategories.map((c: any) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        onClick={submit}
        disabled={loading}
        className="bg-primary text-white px-6 py-2 rounded-lg"
      >
        {loading ? "Creating..." : "Create Product"}
      </button>

    </div>
  )
}