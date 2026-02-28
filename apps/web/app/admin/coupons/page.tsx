"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { AdminCouponService, type Coupon } from "../../../lib/services/admin-coupon.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import CouponFormModal from "../../../components/admin/coupons/CouponFormModal"
import { toast } from "sonner"

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Coupon | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const raw: any = await AdminCouponService.getAll()
      setCoupons(Array.isArray(raw) ? raw : raw?.data ?? raw?.coupons ?? [])
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error("Failed to load coupons", e)
      setCoupons([])
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const deleteCoupon = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminCouponService.delete(deleteId)
      toast.success("Coupon deleted")
      setCoupons(p => p.filter(c => c.id !== deleteId))
      setDeleteId(null)
    } catch { toast.error("Failed to delete") }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Coupons"
        subtitle="Create and manage discount coupons"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus size={15} />
            Add Coupon
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
                <th className="p-4 font-medium">Min Order</th>
                <th className="p-4 font-medium">Usage</th>
                <th className="p-4 font-medium">Expires</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="p-4">
                    <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs">
                      {c.code}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 capitalize text-xs">
                    {c.discountType === "PERCENTAGE" ? "%" : "₹"} Discount
                  </td>
                  <td className="p-4 font-semibold text-gray-900">
                    {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    {c.maxDiscount && <span className="text-xs text-gray-400 ml-1">(max ₹{c.maxDiscount})</span>}
                  </td>
                  <td className="p-4 text-gray-600">
                    {c.minOrderAmount ? `₹${c.minOrderAmount}` : "—"}
                  </td>
                  <td className="p-4">
                    <span className="text-gray-700">
                      {c.usedCount}
                      {c.usageLimit ? <span className="text-gray-400"> / {c.usageLimit}</span> : <span className="text-gray-400"> / ∞</span>}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!coupons.length && (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">No coupons yet. Create your first one!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editTarget) && (
        <CouponFormModal
          initialData={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
          onSuccess={() => { setShowCreate(false); setEditTarget(null); fetch() }}
        />
      )}

      {deleteId && (
        <AdminModal title="Delete Coupon?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
            <button onClick={deleteCoupon} disabled={deleting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
