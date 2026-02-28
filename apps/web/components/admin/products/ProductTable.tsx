"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { AdminProductService, AdminProduct } from "../../../lib/services/admin-product.service"
import TableSkeleton from "../TableSkeleton"
import AdminPageHeader from "../AdminPageHeader"
import AdminModal from "../AdminModal"
import { toast } from "sonner"

export default function AdminProductsTable() {
  const router = useRouter()
  const [data, setData] = useState<AdminProduct[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      if (search.trim()) {
        const res = await AdminProductService.searchProducts(search)
        setData(res.products ?? [])
        setPages(1); setTotal(res.products?.length ?? 0)
        return
      }
      const res = await AdminProductService.getProducts({ page, limit: 12 })
      setData(res.products); setPages(res.pages); setTotal(res.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProducts() }, [page, search])

  const deleteProduct = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminProductService.deleteProduct(deleteId)
      toast.success("Product deleted")
      setData(p => p.filter(x => x.id !== deleteId))
      setDeleteId(null)
    } catch { toast.error("Failed to delete product") }
    finally { setDeleting(false) }
  }

  const toggleSelect = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelected(selected.length === data.length ? [] : data.map(p => p.id))

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Products"
        subtitle={total ? `${total} products` : undefined}
        action={
          <button
            onClick={() => router.push("/admin/products/new")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus size={15} />
            Add Product
          </button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search products by name..."
          value={search}
          onChange={e => { setPage(1); setSearch(e.target.value) }}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
        />
      </div>

      {loading ? <TableSkeleton rows={10} cols={7} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 w-10">
                  <input type="checkbox" checked={selected.length === data.length && data.length > 0} onChange={toggleAll} className="rounded accent-primary"/>
                </th>
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium">Variants</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4">
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} className="rounded accent-primary"/>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images?.[0]?.url || "/placeholder.png"}
                        className="w-10 h-10 object-cover rounded-xl border border-gray-100 flex-shrink-0"
                        alt={p.name}
                      />
                      <div>
                        <p className="font-medium text-gray-900 max-w-[180px] truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{p.category?.name || "—"}</td>
                  <td className="p-4 font-semibold text-gray-900">₹{p.price?.toLocaleString()}</td>
                  <td className="p-4 text-gray-700">{p.quantity}</td>
                  <td className="p-4 text-gray-600">{p.variants?.length || 0}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.inStock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {p.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/products/${p.id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">No products found</td></tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {pages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">‹</button>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">
                  {String(page).padStart(2, "0")}
                </span>
                <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <AdminModal title="Delete Product?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This action cannot be undone. All variants and images will also be deleted.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
            <button onClick={deleteProduct} disabled={deleting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-red-600">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
