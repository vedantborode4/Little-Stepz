"use client"

import { useState } from "react"
import AdminModal from "../AdminModal"
import { AdminBannerService, type AdminBanner, type CreateBannerBody, type BannerPosition } from "../../../lib/services/admin-banner.service"
import { toast } from "sonner"

interface Props {
  mode: "create" | "edit"
  initialData: AdminBanner | null
  onClose: () => void
  onSuccess: () => void
}

const POSITIONS: BannerPosition[] = [
  "HOME_HERO", "HOME_MID", "CATEGORY_TOP", "PRODUCT_SIDEBAR", "CHECKOUT_TOP"
]

export default function BannerFormModal({ mode, initialData, onClose, onSuccess }: Props) {
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
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = "Title is required"
    if (!form.imageUrl.trim()) e.imageUrl = "Image URL is required"
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
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save banner")
    } finally { setLoading(false) }
  }

  const Field = ({ label, error, children }: any) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
  )

  return (
    <AdminModal title={mode === "create" ? "Add Banner" : "Edit Banner"} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <Field label="Title *" error={errors.title}>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Summer Sale" />
        </Field>

        <Field label="Subtitle">
          <Input value={form.subtitle ?? ""} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))} placeholder="Optional subtitle" />
        </Field>

        <Field label="Image URL *" error={errors.imageUrl}>
          <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
          {form.imageUrl && (
            <img src={form.imageUrl} className="mt-2 h-28 w-full object-cover rounded-xl border border-gray-100"
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }} alt="preview" />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Link URL">
            <Input value={form.linkUrl ?? ""} onChange={e => setForm(p => ({ ...p, linkUrl: e.target.value }))} placeholder="/sale" />
          </Field>
          <Field label="Alt Text">
            <Input value={form.altText ?? ""} onChange={e => setForm(p => ({ ...p, altText: e.target.value }))} placeholder="Image description" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Position *" error={errors.position}>
            <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value as BannerPosition }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort Order">
            <Input type="number" min={0} value={form.sortOrder ?? 0}
              onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts At">
            <Input type="date" value={form.startsAt ?? ""}
              onChange={e => setForm(p => ({ ...p, startsAt: e.target.value || undefined }))} />
          </Field>
          <Field label="Ends At">
            <Input type="date" value={form.endsAt ?? ""}
              onChange={e => setForm(p => ({ ...p, endsAt: e.target.value || undefined }))} />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-medium text-gray-700">Active</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90">
            {loading ? "Saving…" : mode === "create" ? "Create Banner" : "Update Banner"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
