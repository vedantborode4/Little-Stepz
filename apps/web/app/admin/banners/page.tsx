"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react"
import { AdminBannerService, type Banner } from "../../../lib/services/admin-banner.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import BannerFormModal from "../../../components/admin/banners/BannerFormModal"
import { toast } from "sonner"

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Banner | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const raw: any = await AdminBannerService.getAll()
      setBanners(Array.isArray(raw) ? raw : raw?.data ?? raw?.banners ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const deleteBanner = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminBannerService.delete(deleteId)
      toast.success("Banner deleted")
      setBanners(p => p.filter(b => b.id !== deleteId))
      setDeleteId(null)
    } catch { toast.error("Failed to delete") }
    finally { setDeleting(false) }
  }

  const toggleActive = async (banner: Banner) => {
    try {
      await AdminBannerService.update(banner.id, { isActive: !banner.isActive })
      setBanners(p => p.map(b => b.id === banner.id ? { ...b, isActive: !b.isActive } : b))
    } catch { toast.error("Failed to update") }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Banners"
        subtitle="Manage homepage and promotional banners"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus size={15} />
            Add Banner
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition group">
              <div className="relative">
                <img
                  src={b.imageUrl}
                  alt={b.title}
                  className="w-full h-44 object-cover"
                  onError={e => { (e.target as any).src = "/placeholder.png" }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setEditTarget(b)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition"
                  >
                    <Pencil size={14} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => setDeleteId(b.id)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-red-50 transition"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                    #{b.position}
                  </span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{b.title}</p>
                  {b.subtitle && <p className="text-xs text-gray-500 mt-0.5">{b.subtitle}</p>}
                  {b.link && <p className="text-xs text-primary mt-0.5 truncate max-w-[180px]">{b.link}</p>}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b.isActive}
                    onChange={() => toggleActive(b)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          ))}
          {!banners.length && (
            <div className="col-span-2 bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400">
              No banners yet. Add your first banner!
            </div>
          )}
        </div>
      )}

      {(showCreate || editTarget) && (
        <BannerFormModal
          initialData={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
          onSuccess={() => { setShowCreate(false); setEditTarget(null); fetch() }}
        />
      )}

      {deleteId && (
        <AdminModal title="Delete Banner?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-gray-600 mb-5">This will permanently remove the banner.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Cancel</button>
            <button onClick={deleteBanner} disabled={deleting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
