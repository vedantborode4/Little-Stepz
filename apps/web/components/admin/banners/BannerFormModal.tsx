"use client"

import { useRef, useState } from "react"
import { Upload, X } from "lucide-react"
import { toast } from "sonner"
import AdminModal from "../AdminModal"
import { AdminBannerService, type Banner } from "../../../lib/services/admin-banner.service"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"

interface Props {
  initialData?: Banner | null
  onClose: () => void
  onSuccess: () => void
}

export default function BannerFormModal({ initialData, onClose, onSuccess }: Props) {
  const isEdit = !!initialData
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    subtitle: initialData?.subtitle ?? "",
    imageUrl: initialData?.imageUrl ?? "",
    link: initialData?.link ?? "",
    position: initialData?.position ?? 1,
    isActive: initialData?.isActive ?? true,
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      // Use cloudinary directly with a generic upload preset for banners
      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", "littlestepz_banners")

      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        set("imageUrl", data.secure_url)
      } else {
        // Fallback: use local object URL for preview
        set("imageUrl", URL.createObjectURL(file))
        toast.warning("Image uploaded locally. Configure Cloudinary for production.")
      }
    } catch {
      set("imageUrl", URL.createObjectURL(file))
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!form.imageUrl) { toast.error("Image is required"); return }

    setLoading(true)
    try {
      if (isEdit) {
        await AdminBannerService.update(initialData!.id, form)
        toast.success("Banner updated")
      } else {
        await AdminBannerService.create(form)
        toast.success("Banner created")
      }
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save banner")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal title={isEdit ? "Edit Banner" : "Add Banner"} onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Banner Image *</label>
          {form.imageUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={form.imageUrl} alt="Banner" className="w-full h-40 object-cover" />
              <button
                onClick={() => set("imageUrl", "")}
                className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-lg hover:bg-black/80 transition"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 hover:bg-primary/5 transition"
            >
              <Upload size={24} />
              <span className="text-sm">{uploading ? "Uploading…" : "Click to upload image"}</span>
            </button>
          )}
          <input ref={fileRef} type="file" hidden accept="image/*"
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        </div>

        {/* Or paste URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Or paste image URL</label>
          <input
            value={form.imageUrl}
            onChange={e => set("imageUrl", e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
          <input value={form.title} onChange={e => set("title", e.target.value)}
            placeholder="Banner title"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Subtitle</label>
          <input value={form.subtitle} onChange={e => set("subtitle", e.target.value)}
            placeholder="Optional subtitle"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Link URL</label>
            <input value={form.link} onChange={e => set("link", e.target.value)}
              placeholder="/products/category/toys"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
            <input type="number" min={1} value={form.position} onChange={e => set("position", Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)}
            className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-medium text-gray-700">Active (visible on site)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading || uploading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
