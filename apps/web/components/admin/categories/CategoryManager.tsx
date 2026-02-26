"use client"

import { useEffect, useState } from "react"
import { Button } from "@repo/ui/index"
import CategoryFormModal from "./CategoryFormModal"
import {
  AdminCategoryService,
  AdminCategory,
} from "../../../lib/services/admin-category.service"

export default function CategoryManager() {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [modalMode, setModalMode] =
    useState<null | "create" | "edit">(null)

  const [selected, setSelected] = useState<AdminCategory | null>(null)

  /* ---------------- FETCH ---------------- */

  const fetchCategories = async () => {
    try {
      const data = await AdminCategoryService.getAll()
      setCategories(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  /* ---------------- DELETE ---------------- */

  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return

    try {
      await AdminCategoryService.delete(id)
      fetchCategories()
    } catch (e: any) {
      alert(e.response?.data?.message)
    }
  }

  /* ---------------- UI ---------------- */

  if (loading) {
    return <div className="p-10 text-center">Loading categories…</div>
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Categories</h1>

        <Button
          className="w-auto px-6"
          onClick={() => {
            setSelected(null)
            setModalMode("create")
          }}
        >
          Add Category
        </Button>
      </div>

      {/* TABLE */}

      <div className="bg-white border rounded-xl overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left">Name</th>
              <th className="text-left">Slug</th>
              <th className="text-left">Parent</th>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>

          <tbody>

            {categories.map((c) => (
              <tr key={c.id} className="border-t">

                <td className="p-4 font-medium">{c.name}</td>

                <td>{c.slug}</td>

                <td>
                  {categories.find((p) => p.id === c.parentId)?.name ||
                    "—"}
                </td>

                <td className="flex gap-2 justify-end pr-4 py-3">

                  <Button
                    className="bg-blue-600 w-auto px-4 h-[40px]"
                    onClick={() => {
                      setSelected(c)
                      setModalMode("edit")
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    className="bg-red-600 w-auto px-4 h-[40px]"
                    onClick={() => remove(c.id)}
                  >
                    Delete
                  </Button>

                </td>

              </tr>
            ))}

            {!categories.length && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-10 text-muted"
                >
                  No categories created yet
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

      {/* MODAL */}

      {modalMode && (
        <CategoryFormModal
          mode={modalMode}
          initialData={modalMode === "edit" ? selected : null}
          categories={categories}
          onClose={() => setModalMode(null)}
          onSuccess={() => {
            setModalMode(null)
            fetchCategories()
          }}
        />
      )}

    </div>
  )
}