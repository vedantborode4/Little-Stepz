"use client"

import { useEffect, useRef, useState } from "react"
import AdminModal from "../AdminModal"
import { AdminBannerService, type AdminBanner, type CreateBannerBody, type BannerPosition } from "../../../lib/services/admin-banner.service"
import { AdminProductImageService } from "../../../lib/services/admin-product-image.service"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"
import { toast } from "sonner"
import { ImagePlus, Loader2, X } from "lucide-react"

// ─── Module-level helpers — NEVER define these inside the component.
// Defining component functions inside another component causes React to
// treat them as new types on every render → unmount + remount → focus lost.
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  mode: "create" | "edit"
  initialData: AdminBanner | null
  onClose: () => void
  onSuccess: () => void
}

const POSITIONS: BannerPosition[] = [
  "HOME_HERO", "HOME_MID", "CATEGORY_TOP", "PRODUCT_SIDEBAR", "CHECKOUT_TOP",
]

export default function BannerFormModal({ mode, initialData, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<CreateBannerBody>({
    title: initialData?.title ?? "",
    subtitle: initialData?.subtitle ?? "",
    imageUrl: initialData?.imageUrl ?? "",
    linkUrl: initialData?.linkUrl ?? "",
    altText: initialData?.altText ?? "",
    position: initialData?.position ?? "HOME_HERO",
    sortOrder: initialData?.sortOrder ?? 0,
    isActive: initialData?.isActive ?? true,
    startsAt: initialData?.startsAt ? initialData.startsAt.split("T")[0] : undefined,
    endsAt: initialData?.endsAt ? initialData.endsAt.split("T")[0] : undefined,
  })
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch fresh data in edit mode using useEffect (not useState)
  useEffect(() => {
    if (mode === "edit" && initialData?.id) {
      AdminBannerService.getById(initialData.id)
        .then((fresh) => {
          setForm({
            title: fresh.title,
            subtitle: fresh.subtitle ?? "",
            imageUrl: fresh.imageUrl,
            linkUrl: fresh.linkUrl ?? "",
            altText: fresh.altText ?? "",
            position: fresh.position,
            sortOrder: fresh.sortOrder,
            isActive: fresh.isActive,
            startsAt: fresh.startsAt ? fresh.startsAt.split("T")[0] : undefined,
            endsAt: fresh.endsAt ? fresh.endsAt.split("T")[0] : undefined,
          })
        })
        .catch(() => { /* silently use initialData */ })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Image upload via Cloudinary (same flow as product images) ───
  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      // Reuse the product image signature endpoint with "banners" as the folder context
      const signature = await AdminProductImageService.getSignature("banners")
      const uploaded = await uploadToCloudinary(file, {
        ...signature,
        folder: signature.folder ?? "banners",
      })
      if (!uploaded?.secure_url) throw new Error("Upload failed")
      setForm((p) => ({ ...p, imageUrl: uploaded.secure_url }))
      setErrors((e) => ({ ...e, imageUrl: "" }))
      toast.success("Image uploaded")
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = "Title is required"
    if (!form.imageUrl.trim()) e.imageUrl = "Please upload a banner image"
    if (!form.position) e.position = "Position is required"
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    try {
      const body: CreateBannerBody = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        subtitle: form.subtitle || undefined,
        linkUrl: form.linkUrl || undefined,
        altText: form.altText || undefined,
      }

      if (mode === "create") {
        await AdminBannerService.create(body)
        toast.success("Banner created")
      } else {
        await AdminBannerService.update(initialData!.id, body)
        toast.success("Banner updated")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save banner")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal title={mode === "create" ? "Add Banner" : "Edit Banner"} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">

        <Field label="Title *" error={errors.title}>
          <StyledInput
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Summer Sale"
          />
        </Field>

        <Field label="Subtitle">
          <StyledInput
            value={form.subtitle ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
            placeholder="Optional subtitle"
          />
        </Field>

        {/* ── Image Upload ── */}
        <Field label="Banner Image *" error={errors.imageUrl}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              // Reset so same file can be re-selected
              e.target.value = ""
            }}
          />

          {form.imageUrl ? (
            <div className="relative group rounded-xl overflow-hidden border border-gray-200">
              <img
                src={form.imageUrl}
                alt="Banner preview"
                className="w-full h-36 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 bg-white text-gray-800 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
                  className="flex items-center gap-1.5 bg-white text-red-500 text-xs px-3 py-2 rounded-lg hover:bg-red-50 transition shadow"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition text-gray-400 hover:text-primary disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-xs font-medium">Uploading…</span>
                </>
              ) : (
                <>
                  <ImagePlus size={22} />
                  <span className="text-xs font-medium">Click to upload banner image</span>
                  <span className="text-[10px] text-gray-300">PNG, JPG, WEBP · recommended 1200×400px</span>
                </>
              )}
            </button>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Link URL">
            <StyledInput
              value={form.linkUrl ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))}
              placeholder="/sale"
            />
          </Field>
          <Field label="Alt Text">
            <StyledInput
              value={form.altText ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, altText: e.target.value }))}
              placeholder="Image description"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Position *" error={errors.position}>
            <select
              value={form.position}
              onChange={(e) => setForm((p) => ({ ...p, position: e.target.value as BannerPosition }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort Order">
            <StyledInput
              type="number"
              min={0}
              value={form.sortOrder ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts At">
            <StyledInput
              type="date"
              value={form.startsAt ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value || undefined }))}
            />
          </Field>
          <Field label="Ends At">
            <StyledInput
              type="date"
              value={form.endsAt ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value || undefined }))}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm font-medium text-gray-700">Active (visible on storefront)</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={submit} disabled={loading || uploading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition">
            {loading ? "Saving…" : mode === "create" ? "Create Banner" : "Update Banner"}
          </button>
        </div>

      </div>
    </AdminModal>
  )
}
