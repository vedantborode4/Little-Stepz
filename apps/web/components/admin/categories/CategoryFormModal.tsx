"use client"

import { useRef, useState } from "react"
import slugify from "slugify"
import { AdminCategoryService } from "../../../lib/services/admin-category.service"
import { AdminProductImageService } from "../../../lib/services/admin-product-image.service"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"
import { toast } from "sonner"
import { ImagePlus, Loader2, X } from "lucide-react"
import SeoPanel from "../SeoPanel"
import { categoryCopy } from "../../../lib/seo/categoryCopy"

interface Category {
  id: string
  name: string
  parentId?: string | null
}

interface Props {
  mode: "create" | "edit"
  initialData?: any
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

export default function CategoryFormModal({
  mode,
  initialData,
  categories,
  onClose,
  onSuccess,
}: Props) {
  const [form, setForm] = useState({
    name: initialData?.name ?? "",
    slug: initialData?.slug ?? "",
    description: initialData?.description ?? "",
    image: initialData?.image ?? "",
    // Use empty string "" to represent "no parent" in the select widget
    parentId: initialData?.parentId ?? "",
    metaTitle: initialData?.metaTitle ?? "",
    metaDescription: initialData?.metaDescription ?? "",
    ogImage: initialData?.ogImage ?? "",
    noindex: initialData?.noindex ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const signature = await AdminProductImageService.getSignature("categories")
      const uploaded = await uploadToCloudinary(file, {
        ...signature,
        folder: signature.folder ?? "categories",
      })
      if (!uploaded?.secure_url) throw new Error("Upload failed")
      setForm((p) => ({ ...p, image: uploaded.secure_url }))
      toast.success("Image uploaded")
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  const onChange = (key: string, value: string | boolean) => {
    setErrors((e) => ({ ...e, [key]: "" }))
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && {
        slug: slugify(value as string, { lower: true, strict: true }),
      }),
    }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Name is required"
    if (!form.slug.trim()) e.slug = "Slug is required"
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    try {
      if (mode === "create") {
        await AdminCategoryService.create({
          name: form.name.trim(),
          slug: form.slug.trim(),
          ...(form.description ? { description: form.description.trim() } : {}),
          ...(form.image ? { image: form.image } : {}),
          // Only send parentId if one is actually selected
          ...(form.parentId ? { parentId: form.parentId } : {}),
          ...(form.metaTitle ? { metaTitle: form.metaTitle } : {}),
          ...(form.metaDescription ? { metaDescription: form.metaDescription } : {}),
          ...(form.ogImage ? { ogImage: form.ogImage } : {}),
          noindex: form.noindex,
        })
        toast.success("Category created")
      } else {
        await AdminCategoryService.update(initialData.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          ...(form.description !== undefined ? { description: form.description.trim() } : {}),
          // Send "" to clear the image on the backend (treated as null)
          image: form.image ?? "",
          // Send null explicitly when "No parent" is selected — this clears the parent on the backend
          parentId: form.parentId === "" ? null : form.parentId,
          metaTitle: form.metaTitle || undefined,
          metaDescription: form.metaDescription || undefined,
          ogImage: form.ogImage || undefined,
          noindex: form.noindex,
        })
        toast.success("Category updated")
      }
      onSuccess()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to save category"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const copy = categoryCopy(form.slug || "", form.name || "")

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">
            {mode === "create" ? "Create Category" : "Edit Category"}
          </h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-2 transition text-faint">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Name *</label>
            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. Toys & Games"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errors.name && <p className="text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Slug *</label>
            <input
              value={form.slug}
              onChange={(e) => onChange("slug", e.target.value)}
              placeholder="e.g. toys-and-games"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
            />
            {errors.slug && <p className="text-xs text-red-500 dark:text-red-400">{errors.slug}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Description</label>
            <input
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="Optional description"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Category Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file)
                e.target.value = ""
              }}
            />
            {form.image ? (
              <div className="relative group rounded-xl overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image}
                  alt="Category preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 bg-surface text-text text-xs px-3 py-2 rounded-lg hover:bg-surface-2 transition shadow"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, image: "" }))}
                    className="flex items-center gap-1.5 bg-surface text-red-500 dark:text-red-400 text-xs px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 transition shadow"
                  >
                    <X size={13} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition text-faint hover:text-primary disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-xs font-medium">Uploading…</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={20} />
                    <span className="text-xs font-medium">Click to upload category image</span>
                    <span className="text-[10px] text-faint">PNG, JPG, WEBP · recommended 600×600px</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Parent Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted">Parent Category</label>
            <select
              value={form.parentId}
              onChange={(e) => onChange("parentId", e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"
            >
              <option value="">— No parent (top-level) —</option>
              {categories
                .filter((c) => c.id !== initialData?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            {mode === "edit" && initialData?.parentId && form.parentId === "" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Saving will remove this category from its parent.
              </p>
            )}
          </div>

          {/* SEO */}
          <SeoPanel
            values={{
              metaTitle: form.metaTitle,
              metaDescription: form.metaDescription,
              ogImage: form.ogImage,
              noindex: form.noindex,
            }}
            onChange={(k, v) => onChange(k, v)}
            previewPath={`products/category/${form.slug || "category-slug"}`}
            fallbackTitle={copy.title}
            fallbackDescription={copy.description}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted hover:bg-surface-2 transition">
              Cancel
            </button>
            <button onClick={submit} disabled={loading || uploading}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition">
              {loading ? "Saving…" : mode === "create" ? "Create" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
