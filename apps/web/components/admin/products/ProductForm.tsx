"use client"

import { useEffect, useState } from "react"
import slugify from "slugify"
import { useRouter } from "next/navigation"
import { createProductSchema } from "@repo/zod-schema/index"
import { AdminProductService } from "../../../lib/services/admin-product.service"
import { getApiError, firstFieldError } from "../../../lib/errors"
import ProductImageManager from "./ProductImageManager"
import CategoryTreeSelect from "../categories/CategoryTreeSelect"
import VariantManager from "./VariantManager"
import VariantMatrixGenerator from "./VariantMatrixGenerator"
import RichTextEditor from "../RichTextEditor"
import SpecificationsEditor, { type SpecRow } from "./SpecificationsEditor"
import type { ProductOption, ProductVariant } from "../../../lib/services/admin-product.service"
import { toast } from "sonner"

interface Props {
  mode?: "create" | "edit"
  initialData?: any
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-muted">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
    />
  )
}

export default function ProductForm({ mode = "create", initialData }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", slug: "", description: "", longDescription: "", price: "", salePrice: "", isOnSale: false, priceDisplay: "BOTH", quantity: 0, inStock: true, categoryId: "",
    preOrderEnabled: false, bookingAmount: "", preOrderLimit: "", preOrderNote: "",
  })
  const [images, setImages] = useState<any[]>([])
  const [specifications, setSpecifications] = useState<SpecRow[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [variantsVersion, setVariantsVersion] = useState(0)
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
        preOrderEnabled: initialData.preOrderEnabled ?? false,
        bookingAmount: initialData.bookingAmount != null ? String(initialData.bookingAmount) : "",
        preOrderLimit: initialData.preOrderLimit != null ? String(initialData.preOrderLimit) : "",
        preOrderNote: initialData.preOrderNote ?? "",
      })
      setImages(initialData.images || [])
      setSpecifications(
        Array.isArray(initialData.specifications)
          ? initialData.specifications.map((s: any) => ({ label: s?.label ?? "", value: s?.value ?? "" }))
          : []
      )
      setVariants(initialData.variants || [])
      setProductOptions(initialData.options || [])
      setProductId(initialData.id)
      setSaved(true)
    }
  }, [initialData])

  // Reload variants + options after the matrix generator (or an option removal)
  // changes them server-side, and force the VariantManager to reseed.
  const refreshVariants = async () => {
    if (!productId) return
    try {
      const p = await AdminProductService.getProductById(productId)
      setVariants(p.variants || [])
      setProductOptions(p.options || [])
      setVariantsVersion((v) => v + 1)
    } catch {
      /* non-fatal — the generator already toasted success */
    }
  }

  const onChange = (key: string, value: any) => {
    setForm(p => ({
      ...p,
      [key]: value,
      ...(key === "name" ? { slug: slugify(value, { lower: true, strict: true }) } : {}),
    }))
    // Editing the name regenerates the slug, so clear any stale slug error too.
    setErrors(p => ({ ...p, [key]: [], ...(key === "name" ? { slug: [] } : {}) }))
  }

  const submit = async () => {
    // Tiptap reports an empty doc as "<p></p>" — treat that as no long description.
    // An empty sale-price field must be omitted (not "") so the optional schema accepts it.
    // Drop blank rows; send undefined (not []) so the optional schema is happy.
    const cleanSpecs = specifications
      .map(s => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter(s => s.label && s.value)
    const payload = {
      ...form,
      longDescription: form.longDescription === "<p></p>" ? "" : form.longDescription,
      salePrice: form.salePrice === "" ? undefined : form.salePrice,
      bookingAmount: form.bookingAmount === "" ? undefined : form.bookingAmount,
      preOrderLimit: form.preOrderLimit === "" ? undefined : form.preOrderLimit,
      preOrderNote: form.preOrderNote === "" ? undefined : form.preOrderNote,
      specifications: cleanSpecs.length ? cleanSpecs : undefined,
    }
    const parsed = createProductSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors(fieldErrors as any)
      console.error("[ProductForm] validation failed:", fieldErrors)
      toast.error(firstFieldError(fieldErrors) || "Please check the highlighted fields")
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
      console.error("[ProductForm] save failed:", e?.response?.data ?? e)
      const { message, fieldErrors } = getApiError(e, "Failed to save product")
      if (fieldErrors) setErrors(fieldErrors)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5 sm:space-y-6">
      {/* Basic info */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <h2 className="font-semibold text-text text-sm sm:text-base">Product Information</h2>

        <Field label="Product Name" error={errors.name?.[0]}>
          <Input placeholder="e.g. Rowan Exalt Soft Dart Blaster" value={form.name} onChange={e => onChange("name", e.target.value)} />
        </Field>

        <Field label="Slug (URL)" error={errors.slug?.[0]}>
          <Input placeholder="auto-generated from name" value={form.slug} onChange={e => onChange("slug", e.target.value)} />
        </Field>

        <Field label="Short Description" error={errors.description?.[0]}>
          <textarea
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
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

        <Field label="Specifications" error={errors.specifications?.[0]}>
          <SpecificationsEditor rows={specifications} onChange={setSpecifications} />
          <p className="text-xs text-faint">
            Shown as a table on the product page. Leave empty to hide it.
          </p>
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
          <span className="text-sm font-medium text-muted">On sale — charge the sale price</span>
        </label>

        {/* Display mode + Qty + Category — 1-col on mobile, 3-col on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Price display">
            <select
              value={form.priceDisplay}
              onChange={e => onChange("priceDisplay", e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
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
          <span className="text-sm font-medium text-muted">Product is in stock</span>
        </label>

        {/* Pre-order */}
        <div className="pt-4 border-t border-border space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.preOrderEnabled} onChange={e => onChange("preOrderEnabled", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm font-medium text-muted">Allow pre-orders when out of stock</span>
          </label>
          {form.preOrderEnabled && (
            <div className="space-y-4 pl-7">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Booking amount (₹)" error={errors.bookingAmount?.[0]}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.bookingAmount}
                    onChange={e => {
                      const v = e.target.value
                      if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onChange("bookingAmount", v)
                    }}
                  />
                </Field>
                <Field label="Pre-order limit (optional)" error={errors.preOrderLimit?.[0]}>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={form.preOrderLimit}
                    onChange={e => onChange("preOrderLimit", e.target.value)}
                  />
                </Field>
                <Field label="Availability note (optional)" error={errors.preOrderNote?.[0]}>
                  <Input placeholder="e.g. Ships by 15 Aug" value={form.preOrderNote} onChange={e => onChange("preOrderNote", e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-faint">
                Customers pay the booking amount now; the balance is collected via a secure link when you raise stock above 0.
              </p>
            </div>
          )}
        </div>

        {/* Save — scoped to product details only */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="w-full sm:w-auto bg-primary text-white px-6 sm:px-8 py-3 rounded-xl font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {loading ? "Saving…" : mode === "edit" ? "Update Product Details" : "Create Product"}
          </button>
          <p className="text-xs text-faint">
            Saves product details only. Images and variants are saved in their own sections below.
          </p>
        </div>
      </div>

      {/* Images & Variants — shown after product is saved */}
      {saved && productId && (
        <>
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6">
            <h2 className="font-semibold text-text text-sm sm:text-base mb-4">Product Images</h2>
            <ProductImageManager productId={productId} images={images} onChange={setImages} />
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-text text-sm sm:text-base mb-1">Options & variant matrix</h2>
              <p className="text-xs text-faint mb-4">
                Define axes like Size and Color, then generate every combination as a variant. You can fine-tune each variant&apos;s price and stock below.
              </p>
              <VariantMatrixGenerator productId={productId} options={productOptions} onGenerated={refreshVariants} />
            </div>

            <div className="border-t border-border pt-5">
              <h2 className="font-semibold text-text text-sm sm:text-base mb-4">Variants</h2>
              <VariantManager key={variantsVersion} productId={productId} initialVariants={variants} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/admin/products")}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3 border border-border rounded-xl text-sm text-muted hover:bg-surface-2 font-medium"
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
