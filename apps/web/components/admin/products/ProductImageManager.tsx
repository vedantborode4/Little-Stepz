"use client"

import { useRef, useState } from "react"
import { Button } from "@repo/ui/index"
import { uploadToCloudinary } from "../../../lib/utils/uploadToCloudinary"
import { AdminProductImageService } from "../../../lib/services/admin-product-image.service"

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
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (files: FileList | null) => {
    if (!files || images.length >= 8) return

    setUploading(true)

    const signature = await AdminProductImageService.getSignature(productId)

    for (const file of Array.from(files)) {
      const uploaded = await uploadToCloudinary(file, signature)

      const saved = await AdminProductImageService.addImage(productId, {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      })

      onChange([...images, saved])
    }

    setUploading(false)
  }

  const remove = async (id: string) => {
    await AdminProductImageService.deleteImage(id)
    onChange(images.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-4">

      <div
        onClick={() => inputRef.current?.click()}
        className="border rounded-xl h-40 flex items-center justify-center cursor-pointer"
      >
        Drag or Upload
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="grid grid-cols-4 gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative">
            <img src={img.url} className="rounded-lg" />
            <button
              onClick={() => remove(img.id)}
              className="absolute top-1 right-1 bg-black text-white text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Button loading={uploading}>Upload</Button>
    </div>
  )
}