"use client"

import { useState } from "react"
import slugify from "slugify"
import { Input, Button } from "@repo/ui/index"

import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryData,
  UpdateCategoryData,
} from "@repo/zod-schema/index"

import { AdminCategoryService } from "../../../lib/services/admin-category.service"

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
    parentId: initialData?.parentId ?? "",
  })

  const [errors, setErrors] =
    useState<Record<string, string[]>>({})

  const [loading, setLoading] = useState(false)

  const onChange = (key: string, value: string) => {
    setForm((p) => ({
      ...p,
      [key]: value,
      ...(key === "name" && {
        slug: slugify(value, { lower: true, strict: true }),
      }),
    }))
  }

  const submit = async () => {
    setLoading(true)

    try {
      if (mode === "create") {
        /* ---------------- CREATE ---------------- */

        const parsed =
          createCategorySchema.safeParse(form)

        if (!parsed.success) {
          setErrors(parsed.error.flatten().fieldErrors)
          setLoading(false)
          return
        }

        await AdminCategoryService.create(parsed.data)
      } else {
        /* ---------------- UPDATE ---------------- */

        const parsed =
          updateCategorySchema.safeParse(form)

        if (!parsed.success) {
          setErrors(parsed.error.flatten().fieldErrors)
          setLoading(false)
          return
        }

        await AdminCategoryService.update(
          initialData.id,
          parsed.data as UpdateCategoryData
        )
      }

      onSuccess()
    } catch (e: any) {
      alert(e.response?.data?.message)
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl w-full max-w-lg p-8 space-y-5">

        <h2 className="text-lg font-semibold">
          {mode === "create"
            ? "Create Category"
            : "Edit Category"}
        </h2>

        {/* NAME */}

        <div>
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) =>
              onChange("name", e.target.value)
            }
          />
          {errors.name && (
            <p className="text-red-500 text-sm">
              {errors.name[0]}
            </p>
          )}
        </div>

        {/* SLUG */}

        <div>
          <Input
            placeholder="Slug"
            value={form.slug}
            onChange={(e) =>
              onChange("slug", e.target.value)
            }
          />
          {errors.slug && (
            <p className="text-red-500 text-sm">
              {errors.slug[0]}
            </p>
          )}
        </div>

        {/* DESCRIPTION */}

        <Input
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            onChange("description", e.target.value)
          }
        />

        {/* PARENT */}

        <select
          className="w-full h-[52px] px-4 rounded-xl border border-border"
          value={form.parentId}
          onChange={(e) =>
            onChange("parentId", e.target.value)
          }
        >
          <option value="">No parent</option>

          {categories
            .filter((c) => c.id !== initialData?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        {/* ACTIONS */}

        <div className="flex gap-3">

          <Button
            className="bg-gray-200 text-black"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button loading={loading} onClick={submit}>
            {mode === "create"
              ? "Create"
              : "Update"}
          </Button>

        </div>

      </div>
    </div>
  )
}