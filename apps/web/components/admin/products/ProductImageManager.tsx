"use client"

import { useRef, useState } from "react"
import { Upload, Trash2, RefreshCw, GripVertical, ImagePlus, Loader2 } from "lucide-react"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"
import { AdminProductImageService } from "../../../lib/services/admin-product-image.service"
import { toast } from "sonner"

interface Props {
  productId: string
  images: any[]
  onChange: (imgs: any[]) => void
}

export default function ProductImageManager({
  productId,
  images,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  /* ─── Add new images ─── */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return
    setUploading(true)
    try {
      const signature = await AdminProductImageService.getSignature(productId)
      const newImages = [...images]

      for (const file of Array.from(files)) {
        const uploaded = await uploadToCloudinary(file, signature)
        const saved = await AdminProductImageService.addImage(productId, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        })
        newImages.push(saved)
      }

      onChange(newImages)
      toast.success(`${files.length} image${files.length > 1 ? "s" : ""} uploaded`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  /* ─── Replace existing image ─── */
  const handleReplace = async (file: File, imageId: string) => {
    setReplacingId(imageId)
    try {
      const signature = await AdminProductImageService.getSignature(productId)
      const uploaded = await uploadToCloudinary(file, signature)
      const updated = await AdminProductImageService.replaceImage(imageId, {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      })
      onChange(images.map((img) => (img.id === imageId ? { ...img, url: updated.url } : img)))
      toast.success("Image replaced")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Replace failed")
    } finally {
      setReplacingId(null)
    }
  }

  /* ─── Delete ─── */
  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      await AdminProductImageService.deleteImage(id)
      onChange(images.filter((i) => i.id !== id))
      toast.success("Image deleted")
    } catch {
      toast.error("Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  /* ─── Drag reorder ─── */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("imageId", id)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const fromId = e.dataTransfer.getData("imageId")
    if (fromId === targetId) return

    const fromIdx = images.findIndex((i) => i.id === fromId)
    const toIdx = images.findIndex((i) => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...images]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved!)

    // Optimistic update
    onChange(reordered)

    try {
      await AdminProductImageService.reorderImage(moved!.id, toIdx)
    } catch {
      toast.error("Reorder failed")
      onChange(images) // rollback
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleUpload(e.dataTransfer.files)
        }}
        className="border-2 border-dashed border-gray-200 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition group"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <Loader2 size={22} className="animate-spin" />
            <p className="text-xs font-medium">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-primary transition">
            <ImagePlus size={22} />
            <p className="text-xs font-medium">Click or drag images to upload</p>
            <p className="text-[10px] text-gray-300">PNG, JPG, WEBP up to 10MB</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept="image/*"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => handleDragStart(e, img.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(img.id) }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, img.id)}
              className={`relative group rounded-xl border-2 overflow-hidden transition cursor-grab
                ${dragOverId === img.id ? "border-primary scale-95" : "border-gray-100"}`}
            >
              {/* Badge for primary */}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 z-10 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-md font-medium">
                  Primary
                </span>
              )}

              <img
                src={img.url}
                alt={img.alt ?? `Image ${i + 1}`}
                className="w-full h-28 object-cover"
              />

              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                {/* Replace */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setReplacingId(img.id)
                    // Create hidden input dynamically
                    const inp = document.createElement("input")
                    inp.type = "file"
                    inp.accept = "image/*"
                    inp.onchange = (ev: any) => {
                      const f = ev.target.files?.[0]
                      if (f) handleReplace(f, img.id)
                    }
                    inp.click()
                  }}
                  disabled={replacingId === img.id || deletingId === img.id}
                  className="p-2 bg-white rounded-lg text-blue-600 hover:bg-blue-50 transition shadow-md disabled:opacity-50"
                  title="Replace image"
                >
                  {replacingId === img.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <RefreshCw size={13} />}
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(img.id) }}
                  disabled={deletingId === img.id || replacingId === img.id}
                  className="p-2 bg-white rounded-lg text-red-500 hover:bg-red-50 transition shadow-md disabled:opacity-50"
                  title="Delete image"
                >
                  {deletingId === img.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>

                {/* Drag handle indicator */}
                <div className="p-2 bg-white/20 rounded-lg text-white cursor-grab" title="Drag to reorder">
                  <GripVertical size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted text-center">
          Drag images to reorder · First image is shown as the product thumbnail
        </p>
      )}
    </div>
  )
}
