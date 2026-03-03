"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { AdminCouponService, type AdminCoupon } from "../../../lib/services/admin-coupon.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import CouponFormModal from "../../../components/admin/coupons/CouponFormModal"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState<null | "create" | AdminCoupon>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminCouponService.getAll({ page, limit: 15 })
      setCoupons(res.coupons)
      setPagination({ pages: res.pages, total: res.total })
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load coupons")
      setCoupons([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [page])

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminCouponService.delete(deleteId)
      toast.success("Coupon deleted")
      setDeleteId(null); fetch()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to delete") }
    finally { setDeleting(false) }
  }

  const isExpired = (c: AdminCoupon) => c.validUntil && new Date(c.validUntil) < new Date()
  const isActive = (c: AdminCoupon) => c.isActive && !isExpired(c)

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Coupons"
        subtitle={`${pagination.total} coupons`}
        action={
          <button onClick={() => setFormModal("create")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> Create Coupon
          </button>
        }
      />

      {loading ? <TableSkeleton rows={8} cols={7} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Code</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Discount</th>
                <th className="p-4 font-medium">Usage</th>
                <th className="p-4 font-medium">Valid Until</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4">
                    <span className="font-mono text-xs bg-gray-100 px-2.5 py-1.5 rounded-lg font-semibold tracking-wide">{c.code}</span>
                  </td>
                  <td className="p-4 text-gray-600">{c.type}</td>
                  <td className="p-4 font-semibold text-gray-900">
                    {c.type === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}
                    {c.minOrderValue && <span className="text-xs text-gray-400 ml-1">min ₹{c.minOrderValue}</span>}
                  </td>
                  <td className="p-4 text-gray-600">
                    {c.usedCount} / {c.usageLimit ?? "∞"}
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {c.validUntil
                      ? new Date(c.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "No expiry"}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isExpired(c) ? "bg-gray-100 text-gray-500" :
                      isActive(c) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                    }`}>
                      {isExpired(c) ? "Expired" : isActive(c) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setFormModal(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!coupons.length && (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400">No coupons yet</td></tr>
              )}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {formModal && (
        <CouponFormModal
          mode={formModal === "create" ? "create" : "edit"}
          initialData={formModal === "create" ? null : formModal}
          onClose={() => setFormModal(null)}
          onSuccess={() => { setFormModal(null); fetch() }}
        />
      )}

      {deleteId && (
        <AdminModal title="Delete Coupon?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Cancel</button>
            <button onClick={remove} disabled={deleting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
