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
      setCoupons(res.coupons); setPagination({ pages: res.pages, total: res.total })
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load coupons")
      setCoupons([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [page])

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await AdminCouponService.delete(deleteId); toast.success("Coupon deleted"); setDeleteId(null); fetch() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed to delete") }
    finally { setDeleting(false) }
  }

  const isExpired = (c: AdminCoupon) => c.validUntil && new Date(c.validUntil) < new Date()
  const isActive = (c: AdminCoupon) => c.isActive && !isExpired(c)

  const StatusChip = ({ c }: { c: AdminCoupon }) => (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isExpired(c) ? "bg-surface-2 text-muted" : isActive(c) ? "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400"}`}>
      {isExpired(c) ? "Expired" : isActive(c) ? "Active" : "Inactive"}
    </span>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader title="Coupons" subtitle={`${pagination.total} coupons`}
        action={
          <button onClick={() => setFormModal("create")} className="flex items-center gap-2 bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> <span className="hidden sm:inline">Create Coupon</span><span className="sm:hidden">Create</span>
          </button>
        }
      />

      {loading ? <TableSkeleton rows={8} cols={7} /> : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border">
                <tr className="text-muted text-left">
                  <th className="p-4 font-medium">Code</th><th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Discount</th><th className="p-4 font-medium">Usage</th>
                  <th className="p-4 font-medium">Valid Until</th><th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2/50 transition">
                    <td className="p-4"><span className="font-mono text-xs bg-surface-2 px-2.5 py-1.5 rounded-lg font-semibold tracking-wide">{c.code}</span></td>
                    <td className="p-4 text-muted">{c.type}</td>
                    <td className="p-4 font-semibold text-text">{c.type==="PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}{c.minOrderValue && <span className="text-xs text-faint ml-1">min ₹{c.minOrderValue}</span>}</td>
                    <td className="p-4 text-muted">{c.usedCount} / {c.usageLimit ?? "∞"}</td>
                    <td className="p-4 text-muted text-xs">{c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "No expiry"}</td>
                    <td className="p-4"><StatusChip c={c} /></td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setFormModal(c)} className="p-1.5 rounded-lg hover:bg-surface-2 text-faint hover:text-muted transition"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500 transition"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!coupons.length && (<tr><td colSpan={7} className="py-16 text-center text-faint">No coupons yet</td></tr>)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border">
            {coupons.map(c => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm bg-surface-2 px-2.5 py-1 rounded-lg font-bold tracking-wide">{c.code}</span>
                  <StatusChip c={c} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{c.type}: <strong>{c.type==="PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}</strong></span>
                  <span>Used: {c.usedCount}/{c.usageLimit ?? "∞"}</span>
                  {c.validUntil && <span>Expires: {new Date(c.validUntil).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</span>}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setFormModal(c)} className="p-2 rounded-xl hover:bg-surface-2 text-faint hover:text-muted transition"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 text-faint hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {!coupons.length && (<div className="py-16 text-center text-faint text-sm">No coupons yet</div>)}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs sm:text-sm text-muted">Page {page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">‹</button>
                <button onClick={() => setPage(p => Math.min(pagination.pages,p+1))} disabled={page===pagination.pages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {formModal && <CouponFormModal mode={formModal==="create" ? "create" : "edit"} initialData={formModal==="create" ? null : formModal} onClose={() => setFormModal(null)} onSuccess={() => { setFormModal(null); fetch() }}/>}
      {deleteId && (
        <AdminModal title="Delete Coupon?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-muted mb-5">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm">Cancel</button>
            <button onClick={remove} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
