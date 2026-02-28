"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Trash2, Star } from "lucide-react"
import { AdminReviewService, type AdminReview } from "../../../lib/services/admin-review.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import { toast } from "sonner"

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("PENDING")

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminReviewService.getAll({ status: statusFilter || undefined, limit: 20 })
      const list = Array.isArray(res) ? res : res?.data ?? res?.reviews ?? []
      setReviews(list)
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error("Failed to load reviews", e)
      setReviews([])
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [statusFilter])

  const approve = async (id: string) => {
    try {
      await AdminReviewService.approve(id)
      toast.success("Review approved")
      setReviews(p => p.map(r => r.id === id ? { ...r, status: "APPROVED" as const } : r))
    } catch { toast.error("Failed") }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this review?")) return
    try {
      await AdminReviewService.delete(id)
      toast.success("Review deleted")
      setReviews(p => p.filter(r => r.id !== id))
    } catch { toast.error("Failed") }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Reviews Moderation"
        subtitle="Approve or remove customer reviews"
      />

      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={8} cols={5} /> : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Product */}
                  <img
                    src={r.product?.images?.[0]?.url || "/placeholder.png"}
                    alt={r.product?.name}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{r.product?.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">by {r.user?.name}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1.5">{r.comment}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    r.status === "APPROVED" ? "bg-green-50 text-green-600" :
                    r.status === "REJECTED" ? "bg-red-50 text-red-500" :
                    "bg-yellow-50 text-yellow-600"}`}>
                    {r.status}
                  </span>

                  {r.status === "PENDING" && (
                    <button onClick={() => approve(r.id)}
                      className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition font-medium">
                      <CheckCircle size={12} /> Approve
                    </button>
                  )}

                  <button onClick={() => remove(r.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!reviews.length && (
            <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400">
              No reviews found for this status
            </div>
          )}
        </div>
      )}
    </div>
  )
}
