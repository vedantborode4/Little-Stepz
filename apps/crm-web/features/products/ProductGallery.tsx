"use client"

import clsx from "clsx"
import { ChevronLeft, ChevronRight, ImagePlus, Link2, Star, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { MAX_PRODUCT_IMAGES, type ProductDetailDto, type ProductImageDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Badge, Card } from "@/components/ui/Display"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { useLinkProductImage, useRemoveProductImage, useReorderProductImages, useSetImageVariant, useUploadProductImage } from "./api"
import { ProductThumb } from "./shared"

const ACCEPT = "image/jpeg,image/png,image/webp"

/** Which variant a photo shows. "" is the whole product. */
function VariantSelect({
  product,
  value,
  onChange,
  id,
  label,
}: {
  product: ProductDetailDto
  value: string
  onChange: (variantId: string) => void
  id?: string
  label?: string
}) {
  return (
    <Select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Whole product</option>
      {product.variants
        .filter((v) => v.status === "ACTIVE" || v.id === value)
        .map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.sku})
          </option>
        ))}
    </Select>
  )
}

function LinkPhotoModal({ product, onClose }: { product: ProductDetailDto; onClose: () => void }) {
  const link = useLinkProductImage(product.id)
  const [url, setUrl] = useState("")
  const [variantId, setVariantId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setError(null)
    try {
      await link.mutateAsync({ url: url.trim(), variantId: variantId || null })
      toast.success("Photo added")
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  return (
    <Modal
      title="Add photo by link"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={link.isPending} disabled={!url.trim()} onClick={save}>
            Add photo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Photo link"
          htmlFor="photo-url"
          hint="An https:// link, e.g. the photo on littlestepz.in. The photo stays where it is."
        >
          <Input id="photo-url" inputMode="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field label="Shows" htmlFor="photo-variant">
          <VariantSelect id="photo-variant" product={product} value={variantId} onChange={setVariantId} />
        </Field>
        {error && <FormError message={error} />}
      </div>
    </Modal>
  )
}

/** The product's photos: the first is the main one; each can belong to one variant (a colour). */
export default function ProductGallery({ product, manage }: { product: ProductDetailDto; manage: boolean }) {
  const upload = useUploadProductImage(product.id)
  const reorder = useReorderProductImages(product.id)
  const setVariant = useSetImageVariant(product.id)
  const remove = useRemoveProductImage(product.id)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState("")
  const [linking, setLinking] = useState(false)
  const [removing, setRemoving] = useState<ProductImageDto | null>(null)
  const images = product.images
  const variantName = (id: string | null) => product.variants.find((v) => v.id === id)?.name
  const full = images.length >= MAX_PRODUCT_IMAGES

  const uploadFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, MAX_PRODUCT_IMAGES - images.length)
    let added = 0
    for (const file of list) {
      try {
        await upload.mutateAsync({ file, variantId: uploadFor || null })
        added++
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`)
      }
    }
    if (added) toast.success(added === 1 ? "Photo uploaded" : `${added} photos uploaded`)
    if (fileInput.current) fileInput.current.value = ""
  }

  const move = (from: number, to: number) => {
    const ids = images.map((i) => i.id)
    const [id] = ids.splice(from, 1)
    ids.splice(to, 0, id!)
    reorder.mutateAsync(ids).catch((err) => toast.error(errorMessage(err)))
  }

  return (
    <Card title={`Photos${images.length ? ` (${images.length})` : ""}`}>
      {images.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <ProductThumb src={null} alt={product.name} size={96} />
          <p className="text-sm text-muted">No photos yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-3 gap-2">
          {images.map((image, i) => (
            <li key={image.id} className="space-y-1">
              <div className={clsx("relative rounded-xl overflow-hidden border", i === 0 ? "border-primary" : "border-border")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary and website hosts; next/image would need each allow-listed */}
                <img
                  src={image.url}
                  alt={`${product.name} photo ${i + 1}`}
                  className="aspect-square w-full object-cover bg-surface-2"
                  loading="lazy"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 rounded-full bg-primary text-white text-[10px] font-semibold px-2 py-0.5">
                    Main
                  </span>
                )}
                {manage && (
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 text-white">
                    <button
                      type="button"
                      aria-label="Move earlier"
                      disabled={i === 0 || reorder.isPending}
                      onClick={() => move(i, i - 1)}
                      className="p-1.5 disabled:opacity-30 hover:bg-white/15"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        aria-label="Make main photo"
                        title="Make main photo"
                        disabled={reorder.isPending}
                        onClick={() => move(i, 0)}
                        className="p-1.5 hover:bg-white/15"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Remove photo"
                      title="Remove photo"
                      onClick={() => setRemoving(image)}
                      className="p-1.5 hover:bg-white/15"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move later"
                      disabled={i === images.length - 1 || reorder.isPending}
                      onClick={() => move(i, i + 1)}
                      className="p-1.5 disabled:opacity-30 hover:bg-white/15"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
              {manage && product.variants.length > 1 ? (
                <select
                  aria-label="Photo shows"
                  value={image.variantId ?? ""}
                  onChange={(e) =>
                    setVariant
                      .mutateAsync({ imageId: image.id, variantId: e.target.value || null })
                      .catch((err) => toast.error(errorMessage(err)))
                  }
                  className="w-full text-[11px] text-muted bg-surface border border-border rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Whole product</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              ) : (
                image.variantId && <Badge>{variantName(image.variantId)}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {manage && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-col sm:flex-row 2xl:flex-col gap-2">
            {product.variants.length > 1 && (
              <div className="sm:w-72 2xl:w-auto">
                <VariantSelect product={product} value={uploadFor} onChange={setUploadFor} label="New photos show" />
              </div>
            )}
            <div className="flex gap-2 sm:w-72 2xl:w-auto">
              <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
              <Button
                className="flex-1"
                size="sm"
                icon={<ImagePlus size={14} />}
                loading={upload.isPending}
                disabled={full}
                onClick={() => fileInput.current?.click()}
              >
                Upload
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="secondary"
                icon={<Link2 size={14} />}
                disabled={full}
                onClick={() => setLinking(true)}
              >
                Add link
              </Button>
            </div>
          </div>
          <p className="text-xs text-faint">
            JPG, PNG or WebP up to 5 MB, {MAX_PRODUCT_IMAGES} photos at most. The first photo shows in lists and POS.
          </p>
        </div>
      )}

      {linking && <LinkPhotoModal product={product} onClose={() => setLinking(false)} />}
      {removing && (
        <ConfirmDialog
          title="Remove photo"
          message={
            removing.source === "UPLOAD"
              ? "The photo is removed from this product and deleted from the CRM's photo storage."
              : "The photo is removed from this product. The original stays where it's hosted (e.g. the website)."
          }
          confirmLabel="Remove"
          loading={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(removing.id)
              setRemoving(null)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Card>
  )
}
