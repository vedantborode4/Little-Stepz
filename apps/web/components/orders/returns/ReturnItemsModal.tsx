"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  XCircle, Package, Minus, Plus, ImagePlus, Video, Loader2, X, ArrowLeft, CheckCircle, AlertTriangle,
} from "lucide-react"
import {
  RETURN_MAX_IMAGES,
  RETURN_MAX_VIDEOS,
  SELLER_FAULT_REASON_CODES,
  upiIdSchema,
  type ReturnMedia,
  type ReturnReasonCode,
} from "@repo/zod-schema/index"
import {
  ReturnService,
  uploadReturnMedia,
  RETURN_REASONS,
  type OrderReturns,
  type ReturnQuote,
  type UploadSignature,
} from "../../../lib/services/return.service"
import { friendlyError } from "../../../lib/errorMessages"
import { cldFill } from "../../../lib/utils/cloudinaryUrl"

type Step = "items" | "details" | "review" | "done"

const BLOCK_COPY: Record<string, string> = {
  NOT_RETURNABLE: "Not returnable",
  ALREADY_RETURNED: "Already in a return",
}

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video")
    el.preload = "metadata"
    el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(el.duration) }
    el.onerror = () => resolve(0)
    el.src = URL.createObjectURL(file)
  })
}

export default function ReturnItemsModal({
  orderId,
  data,
  onClose,
  onDone,
}: {
  orderId: string
  data: OrderReturns
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState<Step>("items")
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode | null>(null)
  const [description, setDescription] = useState("")
  const [upi, setUpi] = useState("")
  const [media, setMedia] = useState<ReturnMedia[]>([])
  const [uploading, setUploading] = useState(0)
  const [quote, setQuote] = useState<ReturnQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const signature = useRef<UploadSignature | null>(null)
  // One key for the life of the dialog: a retried or double-clicked submit returns the
  // same return instead of creating a second one.
  const idempotencyKey = useRef(crypto.randomUUID())
  const fileInput = useRef<HTMLInputElement>(null)

  const selection = useMemo(
    () => Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
    [qty]
  )
  const reasons = data.isPreOrder
    ? RETURN_REASONS.filter((r) => SELLER_FAULT_REASON_CODES.includes(r.code))
    : RETURN_REASONS
  const images = media.filter((m) => m.type === "image").length
  const videos = media.filter((m) => m.type === "video").length
  const upiValid = !data.needsUpi || upiIdSchema.safeParse(upi).success
  const detailsValid =
    reasonCode !== null &&
    (reasonCode !== "OTHER" || description.trim().length >= 10) &&
    images >= 1 &&
    uploading === 0 &&
    upiValid

  const setItemQty = (id: string, next: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, next)) }))

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      signature.current ??= await ReturnService.uploadSignature(orderId)
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't start the upload"))
      return
    }
    const sig = signature.current
    let imgCount = images
    let vidCount = videos

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/")
      if (isVideo) {
        if (vidCount >= RETURN_MAX_VIDEOS) { toast.error("Only one video can be attached"); continue }
        if (file.size > sig.limits.maxVideoBytes) { toast.error(`${file.name} is larger than 50 MB`); continue }
        if ((await videoDuration(file)) > sig.limits.maxVideoSeconds) { toast.error("Videos must be 60 seconds or shorter"); continue }
        vidCount++
      } else if (file.type.startsWith("image/")) {
        if (imgCount >= RETURN_MAX_IMAGES) { toast.error(`Up to ${RETURN_MAX_IMAGES} photos`); continue }
        if (file.size > sig.limits.maxImageBytes) { toast.error(`${file.name} is larger than 10 MB`); continue }
        imgCount++
      } else {
        toast.error(`${file.name} isn't a photo or video`)
        continue
      }

      setUploading((n) => n + 1)
      uploadReturnMedia(file, sig)
        .then((m) => setMedia((list) => [...list, m]))
        .catch(() => toast.error(`Couldn't upload ${file.name}`))
        .finally(() => setUploading((n) => n - 1))
    }
  }

  const toReview = async () => {
    setBusy(true)
    try {
      setQuote(await ReturnService.quote(orderId, selection))
      setStep("review")
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't estimate your refund"))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!reasonCode) return
    setBusy(true)
    try {
      await ReturnService.create(orderId, {
        items: selection,
        reasonCode,
        description: description.trim() || undefined,
        media,
        refundUpiId: data.needsUpi ? upi.trim() : undefined,
        idempotencyKey: idempotencyKey.current,
      })
      setStep("done")
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't submit your return"))
    } finally {
      setBusy(false)
    }
  }

  const itemName = (id: string) => data.items.find((i) => i.orderItemId === id)?.productName ?? "Item"

  if (step === "done") {
    return (
      <Shell title="Return requested" onClose={onDone}>
        <div className="p-6 text-center">
          <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-sm text-muted mb-6">
            We&apos;ve received your request and will review it within 2–3 business days. Keep the items
            in their original packaging until they&apos;re collected.
          </p>
          <button onClick={onDone} className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:opacity-90 transition">
            Done
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      title={step === "items" ? "Select items to return" : step === "details" ? "Tell us what happened" : "Review your return"}
      onClose={onClose}
      onBack={step === "items" ? undefined : () => setStep(step === "review" ? "details" : "items")}
    >
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        {step === "items" && (
          <>
            {data.windowEndsAt && (
              <p className="text-xs text-muted">
                Return window closes {new Date(data.windowEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.
              </p>
            )}
            {data.items.map((item) => {
              const q = qty[item.orderItemId] ?? 0
              const blocked = !item.returnable || item.remainingQuantity === 0
              return (
                <div
                  key={item.orderItemId}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                    q > 0 ? "border-primary bg-primary/5" : "border-border"
                  } ${blocked ? "opacity-60" : ""}`}
                >
                  {item.image ? (
                    <img src={cldFill(item.image, 120)} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center"><Package size={16} className="text-faint" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{item.productName}</p>
                    {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
                    <p className="text-xs text-muted">
                      {blocked
                        ? BLOCK_COPY[item.blockedReason ?? ""] ?? "Not available"
                        : `${item.remainingQuantity} of ${item.quantity} can be returned`}
                    </p>
                  </div>
                  {!blocked && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Decrease"
                        onClick={() => setItemQty(item.orderItemId, q - 1, item.remainingQuantity)}
                        disabled={q === 0}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-40"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-text">{q}</span>
                      <button
                        type="button"
                        aria-label="Increase"
                        onClick={() => setItemQty(item.orderItemId, q + 1, item.remainingQuantity)}
                        disabled={q >= item.remainingQuantity}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-40"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <button
              onClick={() => setStep("details")}
              disabled={selection.length === 0}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:opacity-90 transition disabled:opacity-50"
            >
              Continue
            </button>
          </>
        )}

        {step === "details" && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Reason</p>
              {reasons.map((r) => (
                <label key={r.code} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition">
                  <input
                    type="radio"
                    name="reason"
                    checked={reasonCode === r.code}
                    onChange={() => setReasonCode(r.code)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-muted">{r.label}</span>
                </label>
              ))}
              {data.isPreOrder && (
                <p className="text-xs text-muted">Pre-order items can be returned only if they arrive damaged, defective or incorrect.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-text">
                Details {reasonCode === "OTHER" ? <span className="text-red-500">*</span> : <span className="text-faint font-normal">(optional)</span>}
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Describe the issue"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              />
              {reasonCode === "OTHER" && description.trim().length < 10 && (
                <p className="text-xs text-muted">At least 10 characters.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text">
                Photos &amp; video <span className="text-red-500">*</span>
              </p>
              <p className="text-xs text-muted">
                At least one clear photo of the item (up to {RETURN_MAX_IMAGES}). An unboxing video up to 60 seconds helps us process damage claims faster.
              </p>
              <div className="flex flex-wrap gap-2">
                {media.map((m) => (
                  <div key={m.publicId} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-2">
                    {m.type === "image" ? (
                      <img src={cldFill(m.url, 128)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Video size={18} className="text-muted" /></div>
                    )}
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => setMedia((list) => list.filter((x) => x.publicId !== m.publicId))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div key={`up-${i}`} className="w-16 h-16 rounded-lg border border-border bg-surface-2 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-muted" />
                  </div>
                ))}
                {(images < RETURN_MAX_IMAGES || videos < RETURN_MAX_VIDEOS) && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="w-16 h-16 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-primary hover:text-primary transition"
                  >
                    <ImagePlus size={18} />
                    <span className="text-[10px] mt-0.5">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(e) => { void onFiles(e.target.files); e.target.value = "" }}
              />
            </div>

            {data.needsUpi && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-text">UPI ID for your refund <span className="text-red-500">*</span></p>
                <p className="text-xs text-muted">Part of this order was paid in cash, so we&apos;ll send that refund to your UPI ID.</p>
                <input
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="name@bank"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                />
                {upi && !upiValid && <p className="text-xs text-red-500">Enter a valid UPI ID (e.g. name@bank)</p>}
              </div>
            )}

            <button
              onClick={toReview}
              disabled={!detailsValid || busy}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} Review return
            </button>
          </>
        )}

        {step === "review" && quote && (
          <>
            <div className="rounded-xl border border-border divide-y divide-border">
              {quote.items.map((i) => (
                <div key={i.orderItemId} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-muted truncate pr-3">{itemName(i.orderItemId)} × {i.quantity}</span>
                  <span className="text-text font-medium">{money(i.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 text-sm font-semibold text-text">
                <span>Estimated refund</span>
                <span>{money(quote.estimatedRefund)}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 px-3 py-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The refund is each item&apos;s share of what you paid after discounts, confirmed once the items
                reach us and pass inspection.{quote.shippingNote ? ` ${quote.shippingNote}` : ""}
              </p>
            </div>
            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} Submit return
            </button>
          </>
        )}
      </div>
    </Shell>
  )
}

function Shell({
  title,
  onClose,
  onBack,
  children,
}: {
  title: string
  onClose: () => void
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} aria-label="Back" className="p-1 rounded-lg hover:bg-surface-2 text-muted">
                <ArrowLeft size={15} />
              </button>
            )}
            <h2 className="text-base font-semibold text-text">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-2 text-faint">
            <XCircle size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
