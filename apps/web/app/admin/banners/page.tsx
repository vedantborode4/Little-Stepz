"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { AdminBannerService, type AdminBanner } from "../../../lib/services/admin-banner.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import BannerFormModal from "../../../components/admin/banners/BannerFormModal"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState<null | "create" | AdminBanner>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminBannerService.getAll({ limit: 50 })
      setBanners(res.banners)
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load banners")
      setBanners([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const handleToggle = async (id: string) => {
    setToggling(id)
    try {
      const res = await AdminBannerService.toggle(id)
      setBanners(prev => prev.map(b => b.id === id ? { ...b, isActive: res.isActive } : b))
      toast.success(res.isActive ? "Banner activated" : "Banner deactivated")
    } catch (e: any) { toast.error("Failed to toggle banner") }
    finally { setToggling(null) }
  }

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminBannerService.delete(deleteId)
      toast.success("Banner deleted")
      setDeleteId(null); fetch()
    } catch (e: any) { toast.error("Failed to delete banner") }
    finally { setDeleting(false) }
  }

  const POSITION_COLORS: Record<string, string> = {
    HOME_HERO: "bg-primary/10 text-primary",
    HOME_MID: "bg-blue-50 text-blue-700",
    CATEGORY_TOP: "bg-green-50 text-green-700",
    PRODUCT_SIDEBAR: "bg-purple-50 text-purple-700",
    CHECKOUT_TOP: "bg-orange-50 text-orange-700",
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Banners"
        subtitle={`${banners.length} banners`}
        action={
          <button onClick={() => setFormModal("create")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> Add Banner
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
          <p className="text-gray-400 mb-4">No banners yet</p>
          <button onClick={() => setFormModal("create")}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            Create your first banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {banners.map(b => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition group">
              <div className="relative">
                <img
                  src={b.imageUrl}
                  alt={b.altText ?? b.title}
                  className="w-full h-44 object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = "/placeholder.png" }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                  <button onClick={() => setFormModal(b)}
                    className="p-2.5 bg-white rounded-xl text-gray-700 hover:bg-gray-100 transition shadow-lg">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteId(b.id)}
                    className="p-2.5 bg-white rounded-xl text-red-500 hover:bg-red-50 transition shadow-lg">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="absolute top-3 left-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${POSITION_COLORS[b.position] ?? "bg-gray-100 text-gray-600"}`}>
                    {b.position.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate">{b.title}</h3>
                    {b.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.subtitle}</p>}
                    {b.linkUrl && <p className="text-xs text-blue-500 mt-1 truncate">{b.linkUrl}</p>}
                    {b.clickCount > 0 && <p className="text-xs text-gray-400 mt-1">{b.clickCount} clicks</p>}
                  </div>
                  <button
                    onClick={() => handleToggle(b.id)}
                    disabled={toggling === b.id}
                    className="ml-2 flex-shrink-0 disabled:opacity-60"
                    title={b.isActive ? "Deactivate" : "Activate"}
                  >
                    {b.isActive
                      ? <ToggleRight size={24} className="text-green-500" />
                      : <ToggleLeft size={24} className="text-gray-400" />}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-gray-400">Order: {b.sortOrder}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formModal && (
        <BannerFormModal
          mode={formModal === "create" ? "create" : "edit"}
          initialData={formModal === "create" ? null : formModal}
          onClose={() => setFormModal(null)}
          onSuccess={() => { setFormModal(null); fetch() }}
        />
      )}

      {deleteId && (
        <AdminModal title="Delete Banner?" onClose={() => setDeleteId(null)} width="max-w-sm">
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
