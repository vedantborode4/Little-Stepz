"use client"

import { useEffect, useState } from "react"
import { Star, Trash2 } from "lucide-react"
import { AdminReviewService } from "../../../lib/services/admin-review.service"
import { AdminProductService, type AdminProduct } from "../../../lib/services/admin-product.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

interface Review {
  id: string
  rating: number
  comment?: string
  createdAt: string
  user: { id: string; name: string }
  productId: string
  productName?: string
  productImage?: string
}

export default function AdminReviewsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load products to select from
  useEffect(() => {
    AdminProductService.getProducts({ limit: 100 })
      .then(r => setProducts(r.products))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [])

  const fetchReviews = async (product: AdminProduct) => {
    setLoading(true)
    setReviews([])
    try {
      const res = await AdminReviewService.getProductReviews(product.id)
      // Response: { reviews: [...], total } or just []
      const list = Array.isArray(res) ? res : res?.reviews ?? res?.data ?? []
      setReviews(list)
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load reviews")
      setReviews([])
    } finally { setLoading(false) }
  }

  const handleSelectProduct = (p: AdminProduct) => {
    setSelectedProduct(p); fetchReviews(p)
  }

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminReviewService.delete(deleteId)
      toast.success("Review deleted")
      setReviews(r => r.filter(x => x.id !== deleteId))
      setDeleteId(null)
    } catch (e: any) { toast.error("Failed to delete review") }
    finally { setDeleting(false) }
  }

  const Stars = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className={i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Reviews Moderation" subtitle="Select a product to view and moderate its reviews" />

      <div className="grid grid-cols-3 gap-6">
        {/* Product selector */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Select Product</h3>
          {productsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
              {products.map(p => (
                <button key={p.id} onClick={() => handleSelectProduct(p)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition ${
                    selectedProduct?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-gray-50 text-gray-700"
                  }`}>
                  <img src={p.images?.[0]?.url || "/placeholder.png"} className="w-8 h-8 object-cover rounded-lg flex-shrink-0" alt={p.name} />
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reviews panel */}
        <div className="col-span-2">
          {!selectedProduct ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-24 flex items-center justify-center text-gray-400 text-sm">
              ← Select a product to see its reviews
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !reviews.length ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center text-gray-400">
              No reviews for <strong>{selectedProduct.name}</strong> yet
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">{reviews.length} review{reviews.length !== 1 ? "s" : ""} for <strong>{selectedProduct.name}</strong></p>
              {reviews.map((r: any) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                        {r.user?.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{r.user?.name ?? "Anonymous"}</p>
                        <Stars rating={r.rating} />
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setDeleteId(r.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {r.comment && <p className="text-sm text-gray-700 mt-3 leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <AdminModal title="Delete Review?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This review will be permanently removed.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Cancel</button>
            <button onClick={remove} disabled={deleting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete Review"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
