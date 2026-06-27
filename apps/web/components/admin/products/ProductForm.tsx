"use client"

import { useEffect, useState } from "react"
import slugify from "slugify"
import { useRouter } from "next/navigation"
import { createProductSchema } from "@repo/zod-schema/index"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import ProductImageManager from "./ProductImageManager"
import CategoryTreeSelect from "../categories/CategoryTreeSelect"
import VariantManager from "./VariantManager"
import RichTextEditor from "../RichTextEditor"
import { toast } from "sonner"

interface Props {
  mode?: "create" | "edit"
  initialData?: any
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
    />
  )
}

export default function ProductForm({ mode = "create", initialData }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", slug: "", description: "", longDescription: "", price: "", salePrice: "", isOnSale: false, priceDisplay: "BOTH", quantity: 0, inStock: true, categoryId: "",
  })
  const [images, setImages] = useState<any[]>([])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name ?? "",
        slug: initialData.slug ?? "",
        description: initialData.description ?? "",
        longDescription: initialData.longDescription ?? "",
        price: initialData.price != null ? String(initialData.price) : "",
        salePrice: initialData.salePrice != null ? String(initialData.salePrice) : "",
        isOnSale: initialData.isOnSale ?? false,
        priceDisplay: initialData.priceDisplay ?? "BOTH",
        quantity: initialData.quantity ?? 0,
        inStock: initialData.inStock ?? true,
        categoryId: initialData.categoryId ?? initialData.category?.id ?? "",
      })
      setImages(initialData.images || [])
      setProductId(initialData.id)
      setSaved(true)
    }
  }, [initialData])

  const onChange = (key: string, value: any) => {
    setForm(p => ({
      ...p,
      [key]: value,
      ...(key === "name" ? { slug: slugify(value, { lower: true, strict: true }) } : {}),
    }))
    setErrors(p => ({ ...p, [key]: [] }))
  }

  const submit = async () => {
    // Tiptap reports an empty doc as "<p></p>" — treat that as no long description.
    // An empty sale-price field must be omitted (not "") so the optional schema accepts it.
    const payload = {
      ...form,
      longDescription: form.longDescription === "<p></p>" ? "" : form.longDescription,
      salePrice: form.salePrice === "" ? undefined : form.salePrice,
    }
    const parsed = createProductSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as any)
      toast.error("Please fix the errors below")
      return
    }

    setLoading(true)
    try {
      if (mode === "edit" && productId) {
        await AdminProductService.updateProduct(productId, parsed.data)
        toast.success("Product updated successfully")
        setSaved(true)
      } else {
        const product = await AdminProductService.createProduct(parsed.data)
        setProductId(product.id)
        setSaved(true)
        toast.success("Product created! Now add images and variants.")
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save product")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5 sm:space-y-6">
      {/* Basic info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Product Information</h2>

        <Field label="Product Name" error={errors.name?.[0]}>
          <Input placeholder="e.g. Rowan Exalt Soft Dart Blaster" value={form.name} onChange={e => onChange("name", e.target.value)} />
        </Field>

        <Field label="Slug (URL)" error={errors.slug?.[0]}>
          <Input placeholder="auto-generated from name" value={form.slug} onChange={e => onChange("slug", e.target.value)} />
        </Field>

        <Field label="Short Description" error={errors.description?.[0]}>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
            value={form.description}
            onChange={e => onChange("description", e.target.value)}
            placeholder="Short summary shown near the title..."
          />
        </Field>

        <Field label="Long Description (formatted)" error={errors.longDescription?.[0]}>
          <RichTextEditor
            value={form.longDescription}
            onChange={html => onChange("longDescription", html)}
          />
        </Field>

        {/* Regular + Sale price — 1-col on mobile, 2-col on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Regular Price (₹)" error={errors.price?.[0]}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.price}
              onChange={e => {
                const v = e.target.value
                if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onChange("price", v)
              }}
            />
          </Field>
          <Field label="Sale Price (₹)" error={errors.salePrice?.[0]}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.salePrice}
              onChange={e => {
                const v = e.target.value
                if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onChange("salePrice", v)
              }}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isOnSale}
            onChange={e => {
              const checked = e.target.checked
              // "Regular only" contradicts charging the sale price — force a valid display.
              if (checked && form.priceDisplay === "REGULAR") onChange("priceDisplay", "BOTH")
              onChange("isOnSale", checked)
            }}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm font-medium text-gray-700">On sale — charge the sale price</span>
        </label>

        {/* Display mode + Qty + Category — 1-col on mobile, 3-col on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Price display">
            <select
              value={form.priceDisplay}
              onChange={e => onChange("priceDisplay", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              <option value="BOTH">Both (sale + regular struck-through)</option>
              <option value="REGULAR" disabled={form.isOnSale}>Regular price only{form.isOnSale ? " (unavailable while on sale)" : ""}</option>
              <option value="SALE">Sale price only</option>
            </select>
          </Field>
          <Field label="Quantity" error={errors.quantity?.[0]}>
            <Input type="number" min={0} value={form.quantity} onChange={e => onChange("quantity", Number(e.target.value))} />
          </Field>
          <Field label="Category">
            <CategoryTreeSelect value={form.categoryId} onChange={id => onChange("categoryId", id)} />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.inStock} onChange={e => onChange("inStock", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-medium text-gray-700">Product is in stock</span>
        </label>
      </div>

      {/* Save button */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full sm:w-auto bg-primary text-white px-6 sm:px-8 py-3 rounded-xl font-medium hover:bg-primary/90 transition disabled:opacity-60"
      >
        {loading ? "Saving…" : mode === "edit" ? "Update Product" : "Create Product"}
      </button>

      {/* Images & Variants — shown after product is saved */}
      {saved && productId && (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-4">Product Images</h2>
            <ProductImageManager productId={productId} images={images} onChange={setImages} />
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base mb-4">Variants</h2>
            <VariantManager productId={productId} initialVariants={initialData?.variants || []} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/admin/products")}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              Back to Products
            </button>
            <button
              onClick={() => router.push("/admin/products/new")}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700"
            >
              Add Another Product
            </button>
          </div>
        </>
      )}
    </div>
  )
}
