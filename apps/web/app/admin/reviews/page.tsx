"use client"

import { useEffect, useState, useCallback } from "react"
import { Star, Trash2, Search, Filter, Package, User, X } from "lucide-react"
import { AdminReviewService, type AdminReview } from "../../../lib/services/admin-review.service"
import { AdminProductService, type AdminProduct } from "../../../lib/services/admin-product.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import { toast } from "sonner"

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={12} className={i<=rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}/>)}
    </div>
  )
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null)
  const [productSearch, setProductSearch] = useState("")
  const [showFilter, setShowFilter] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { AdminProductService.getProducts({ limit: 200 }).then(r => setProducts(r.products)).catch(() => {}) }, [])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = selectedProduct
        ? await AdminReviewService.getProductReviews(selectedProduct.id, { page, limit: 15 })
        : await AdminReviewService.getAll({ page, limit: 15 })
      setReviews(res.reviews); setTotal(res.total); setPages(res.pages)
    } catch { toast.error("Failed to load reviews"); setReviews([]) }
    finally { setLoading(false) }
  }, [page, selectedProduct])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await AdminReviewService.delete(deleteId); toast.success("Review deleted"); setDeleteId(null); fetchReviews() }
    catch { toast.error("Failed to delete review") }
    finally { setDeleting(false) }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Reviews"
        subtitle={`${total} review${total!==1?"s":""}${selectedProduct ? ` · "${selectedProduct.name}"` : " · all products"}`}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {selectedProduct && (
              <button onClick={() => { setSelectedProduct(null); setPage(1) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                <X size={12}/> Clear
              </button>
            )}
            <button onClick={() => setShowFilter(p => !p)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition ${selectedProduct ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <Filter size={14}/>
              <span className="hidden sm:inline">{selectedProduct ? selectedProduct.name.slice(0,16)+"…" : "Filter by Product"}</span>
              <span className="sm:hidden">Filter</span>
            </button>
          </div>
        }
      />

      {showFilter && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products…"
              className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"/>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => { setSelectedProduct(p); setPage(1); setShowFilter(false) }}
                className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs border transition ${selectedProduct?.id===p.id ? "border-primary bg-primary/5 text-primary" : "border-gray-100 hover:border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {p.images?.[0]?.url ? <img src={p.images[0].url} className="w-8 h-8 rounded-lg object-cover shrink-0"/> : <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Package size={12} className="text-gray-300"/></div>}
                <span className="truncate font-medium">{p.name}</span>
              </button>
            ))}
            {!filteredProducts.length && <p className="col-span-2 sm:col-span-3 text-sm text-gray-400 text-center py-4">No products found</p>}
          </div>
        </div>
      )}

      {loading ? <TableSkeleton rows={8} cols={6}/> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-gray-500 text-left">
                  <th className="p-4 font-medium">Product</th><th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Rating</th><th className="p-4 font-medium">Comment</th>
                  <th className="p-4 font-medium">Date</th><th className="p-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        {r.product?.images?.[0]?.url ? <img src={r.product.images[0].url} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0"/> : <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Package size={13} className="text-gray-300"/></div>}
                        <span className="text-gray-800 font-medium max-w-[120px] truncate text-xs">{r.product?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0"><User size={12} className="text-primary"/></div>
                        <div><p className="text-gray-800 font-medium text-xs">{r.user?.name ?? "—"}</p><p className="text-gray-400 text-[10px]">{r.user?.email ?? ""}</p></div>
                      </div>
                    </td>
                    <td className="p-4"><StarDisplay rating={r.rating}/><p className="text-xs text-gray-400 mt-0.5">{r.rating}/5</p></td>
                    <td className="p-4 max-w-xs">{r.comment ? <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">{r.comment}</p> : <span className="text-gray-300 text-xs italic">No comment</span>}</td>
                    <td className="p-4 text-gray-500 text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</td>
                    <td className="p-4 text-right"><button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={14}/></button></td>
                  </tr>
                ))}
                {!reviews.length && (<tr><td colSpan={6} className="py-16 text-center"><Star size={28} className="mx-auto mb-2 text-gray-200"/><p className="text-gray-400 text-sm">No reviews found</p></td></tr>)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {reviews.map(r => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.product?.images?.[0]?.url ? <img src={r.product.images[0].url} className="w-9 h-9 rounded-xl object-cover border border-gray-100 shrink-0"/> : <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0"><Package size={13} className="text-gray-300"/></div>}
                    <span className="font-medium text-gray-900 text-sm truncate">{r.product?.name ?? "—"}</span>
                  </div>
                  <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14}/></button>
                </div>
                <div className="flex items-center gap-2">
                  <StarDisplay rating={r.rating}/>
                  <span className="text-xs text-gray-400">{r.rating}/5 · {r.user?.name}</span>
                </div>
                {r.comment && <p className="text-xs text-gray-600 line-clamp-2">{r.comment}</p>}
                <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</p>
              </div>
            ))}
            {!reviews.length && (<div className="py-16 text-center"><Star size={28} className="mx-auto mb-2 text-gray-200"/><p className="text-gray-400 text-sm">No reviews found</p></div>)}
          </div>

          {pages>1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-gray-500">Page {page} of {pages} · {total} total</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page===pages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <AdminModal title="Delete Review?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This will permanently remove the review.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete Review"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
