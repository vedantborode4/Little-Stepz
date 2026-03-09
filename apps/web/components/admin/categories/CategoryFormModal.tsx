"use client"

import { useState } from "react"
import slugify from "slugify"
import { AdminCategoryService } from "../../../lib/services/admin-category.service"
import { toast } from "sonner"
import { X } from "lucide-react"

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
    // Use empty string "" to represent "no parent" in the select widget
    parentId: initialData?.parentId ?? "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const onChange = (key: string, value: string) => {
    setErrors((e) => ({ ...e, [key]: "" }))
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && {
        slug: slugify(value, { lower: true, strict: true }),
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
          // Only send parentId if one is actually selected
          ...(form.parentId ? { parentId: form.parentId } : {}),
        })
        toast.success("Category created")
      } else {
        await AdminCategoryService.update(initialData.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          ...(form.description !== undefined ? { description: form.description.trim() } : {}),
          // Send null explicitly when "No parent" is selected — this clears the parent on the backend
          parentId: form.parentId === "" ? null : form.parentId,
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "create" ? "Create Category" : "Edit Category"}
          </h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Name *</label>
            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. Toys & Games"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Slug *</label>
            <input
              value={form.slug}
              onChange={(e) => onChange("slug", e.target.value)}
              placeholder="e.g. toys-and-games"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
            />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="Optional description"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Parent Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Parent Category</label>
            <select
              value={form.parentId}
              onChange={(e) => onChange("parentId", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              <option value="">— No parent (top-level) —</option>
              {categories
                .filter((c) => c.id !== initialData?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            {mode === "edit" && initialData?.parentId && form.parentId === "" && (
              <p className="text-xs text-amber-600">
                Saving will remove this category from its parent.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={submit} disabled={loading}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition">
              {loading ? "Saving…" : mode === "create" ? "Create" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
