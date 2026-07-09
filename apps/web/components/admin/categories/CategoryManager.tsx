"use client"

import React, { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react"
import CategoryFormModal from "./CategoryFormModal"
import { AdminCategoryService, AdminCategory } from "../../../lib/services/admin-category.service"
import AdminPageHeader from "../AdminPageHeader"
import AdminModal from "../AdminModal"
import { toast } from "sonner"

export default function CategoryManager() {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<null | "create" | "edit">(null)
  const [selected, setSelected] = useState<AdminCategory | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = async () => {
    try { const data = await AdminCategoryService.getAll(); setCategories(data) }
    catch { toast.error("Failed to load categories") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminCategoryService.delete(deleteId); toast.success("Category deleted")
      setCategories(p => p.filter(c => c.id !== deleteId)); setDeleteId(null)
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to delete category") }
    finally { setDeleting(false) }
  }

  const topLevel = categories.filter(c => !c.parentId)
  const children = (parentId: string) => categories.filter(c => c.parentId === parentId)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-surface-2 rounded-xl w-40 animate-pulse"/>
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border-b border-border flex gap-4">
              <div className="h-4 bg-surface-2 rounded w-32 animate-pulse"/>
              <div className="h-4 bg-surface-2 rounded w-24 animate-pulse"/>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader title="Categories" subtitle={`${categories.length} categories`}
        action={
          <button onClick={() => { setSelected(null); setModalMode("create") }}
            className="flex items-center gap-2 bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            <Plus size={15}/> <span className="hidden sm:inline">Add Category</span><span className="sm:hidden">Add</span>
          </button>
        }
      />

      {/* Desktop table */}
      <div className="hidden sm:block bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 border-b border-border">
            <tr className="text-muted text-left">
              <th className="p-4 font-medium">Name</th><th className="p-4 font-medium">Slug</th>
              <th className="p-4 font-medium">Parent</th><th className="p-4 font-medium">Subcategories</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.map(c => (
              <React.Fragment key={c.id}>
                <tr className="border-t border-border hover:bg-surface-2/50 transition">
                  <td className="p-4"><div className="flex items-center gap-2">
                    {c.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.image} alt={c.name} className="w-8 h-8 rounded-md object-cover shrink-0"/>
                      : <FolderTree size={14} className="text-primary shrink-0"/>}
                    <span className="font-semibold text-text">{c.name}</span></div></td>
                  <td className="p-4 text-muted font-mono text-xs">{c.slug}</td>
                  <td className="p-4 text-faint">—</td>
                  <td className="p-4"><span className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">{children(c.id).length} sub</span></td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setSelected(c); setModalMode("edit") }} className="p-1.5 rounded-lg hover:bg-surface-2 text-faint hover:text-muted transition"><Pencil size={14}/></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500 transition"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
                {children(c.id).map(child => (
                  <tr key={child.id} className="border-t border-border hover:bg-surface-2/50 transition bg-surface-2/30">
                    <td className="p-4 pl-10"><div className="flex items-center gap-2"><span className="text-faint">└</span><span className="text-muted">{child.name}</span></div></td>
                    <td className="p-4 text-muted font-mono text-xs">{child.slug}</td>
                    <td className="p-4 text-muted text-xs">{c.name}</td>
                    <td className="p-4 text-faint">—</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setSelected(child); setModalMode("edit") }} className="p-1.5 rounded-lg hover:bg-surface-2 text-faint hover:text-muted transition"><Pencil size={14}/></button>
                        <button onClick={() => setDeleteId(child.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500 transition"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {!categories.length && (<tr><td colSpan={5} className="py-16 text-center text-faint">No categories yet</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {topLevel.map(c => (
          <div key={c.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 min-w-0">
                {c.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image} alt={c.name} className="w-8 h-8 rounded-md object-cover shrink-0"/>
                  : <FolderTree size={14} className="text-primary shrink-0"/>}
                <div className="min-w-0">
                  <p className="font-semibold text-text text-sm truncate">{c.name}</p>
                  <p className="text-xs text-faint font-mono">{c.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {children(c.id).length > 0 && <span className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">{children(c.id).length} sub</span>}
                <button onClick={() => { setSelected(c); setModalMode("edit") }} className="p-1.5 rounded-xl hover:bg-surface-2 text-faint"><Pencil size={13}/></button>
                <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500"><Trash2 size={13}/></button>
              </div>
            </div>
            {children(c.id).length > 0 && (
              <div className="border-t border-border divide-y divide-border">
                {children(c.id).map(child => (
                  <div key={child.id} className="flex items-center justify-between px-4 py-3 bg-surface-2/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-faint text-xs">└</span>
                      <div className="min-w-0">
                        <p className="text-sm text-muted truncate">{child.name}</p>
                        <p className="text-xs text-faint font-mono">{child.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { setSelected(child); setModalMode("edit") }} className="p-1.5 rounded-xl hover:bg-surface-2 text-faint"><Pencil size={13}/></button>
                      <button onClick={() => setDeleteId(child.id)} className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!categories.length && (<div className="bg-surface border border-border rounded-2xl py-16 text-center text-faint text-sm">No categories yet</div>)}
      </div>

      {modalMode && (
        <CategoryFormModal mode={modalMode} initialData={modalMode==="edit" ? selected : null}
          categories={categories} onClose={() => setModalMode(null)} onSuccess={() => { setModalMode(null); fetch() }}/>
      )}
      {deleteId && (
        <AdminModal title="Delete Category?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-muted mb-5">Products in this category will be unassigned. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm">Cancel</button>
            <button onClick={remove} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
