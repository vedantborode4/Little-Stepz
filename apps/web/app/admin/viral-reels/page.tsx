"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Pencil, Play, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { toast } from "sonner"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import ReelFormModal from "../../../components/admin/viral-reels/ReelFormModal"
import { AdminViralReelService, type AdminViralReel } from "../../../lib/services/admin-viral-reel.service"

export default function AdminViralReelsPage() {
  const [reels, setReels] = useState<AdminViralReel[]>([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState<null | "create" | AdminViralReel>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setReels(await AdminViralReelService.getAll())
    } catch {
      toast.error("Failed to load reels")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = async (id: string) => {
    setToggling(id)
    try {
      const res = await AdminViralReelService.toggle(id)
      setReels((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: res.isActive } : r)))
      toast.success(res.isActive ? "Reel shown on home page" : "Reel hidden")
    } catch {
      toast.error("Failed to update reel")
    } finally {
      setToggling(null)
    }
  }

  const remove = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await AdminViralReelService.delete(deleteId)
      toast.success("Reel deleted")
      setDeleteId(null)
      load()
    } catch {
      toast.error("Failed to delete reel")
    } finally {
      setDeleting(false)
    }
  }

  const activeCount = reels.filter((r) => r.isActive).length

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Viral Reels"
        subtitle={`${reels.length} reels · ${activeCount} on the home page "Viral Products" section`}
        action={
          <button onClick={() => setFormModal("create")} className="flex items-center gap-2 bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> <span className="hidden sm:inline">Add Reel</span><span className="sm:hidden">Add</span>
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-9/16 bg-surface-2" />
              <div className="p-3 space-y-2"><div className="h-3 bg-surface-2 rounded w-2/3" /></div>
            </div>
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl py-20 text-center">
          <p className="text-faint mb-4">No reels yet. The Viral Products section stays hidden until you add one.</p>
          <button onClick={() => setFormModal("create")} className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium">Add your first reel</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {reels.map((r) => (
            <div key={r.id} className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
              <div className="relative aspect-9/16 bg-surface-2 group">
                <img src={r.coverImageUrl} alt={r.caption ?? "Reel cover"} className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">
                  <Play size={14} fill="currentColor" />
                </span>
                {!r.isActive && (
                  <span className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-surface text-muted font-medium">Hidden</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center justify-center gap-2">
                  <button onClick={() => setFormModal(r)} aria-label="Edit reel" className="p-2.5 bg-surface rounded-xl text-muted hover:bg-surface-2 shadow-lg"><Pencil size={15} /></button>
                  <a href={r.reelUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on Instagram" className="p-2.5 bg-surface rounded-xl text-muted hover:bg-surface-2 shadow-lg"><ExternalLink size={15} /></a>
                  <button onClick={() => setDeleteId(r.id)} aria-label="Delete reel" className="p-2.5 bg-surface rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 shadow-lg"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                {r.caption && <p className="text-sm font-medium text-text line-clamp-2">{r.caption}</p>}
                <p className="text-xs text-muted truncate">
                  {!r.products.some((p) => p.visible !== false)
                    ? <span className="text-red-500 dark:text-red-400">No live products — hidden on the store</span>
                    : r.products.map((p) => p.name).join(", ")}
                </p>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className="text-xs text-faint">Order: {r.sortOrder}</span>
                  <button onClick={() => toggle(r.id)} disabled={toggling === r.id} aria-label={r.isActive ? "Hide reel" : "Show reel"} className="disabled:opacity-60">
                    {r.isActive ? <ToggleRight size={24} className="text-green-500 dark:text-green-400" /> : <ToggleLeft size={24} className="text-faint" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formModal && (
        <ReelFormModal
          reel={formModal === "create" ? null : formModal}
          onClose={() => setFormModal(null)}
          onSuccess={() => { setFormModal(null); load() }}
        />
      )}
      {deleteId && (
        <AdminModal title="Delete reel?" onClose={() => setDeleteId(null)} width="max-w-sm">
          <p className="text-sm text-muted mb-5">It will be removed from the home page. The reel stays on Instagram.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm">Cancel</button>
            <button onClick={remove} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
