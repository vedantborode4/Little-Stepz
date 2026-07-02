"use client"

import { useState } from "react"
import { AdminProductService, type ProductOption, type MatrixBody } from "../../../lib/services/admin-product.service"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DraftValue { value: string; swatchHex: string }
interface DraftOption { name: string; values: DraftValue[] }

const inputCls =
  "border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"

export default function VariantMatrixGenerator({
  productId,
  options = [],
  onGenerated,
}: {
  productId: string
  options?: ProductOption[]
  onGenerated: () => void
}) {
  const [draft, setDraft] = useState<DraftOption[]>([])
  const [defPrice, setDefPrice] = useState("")
  const [defStock, setDefStock] = useState("")
  const [generating, setGenerating] = useState(false)

  const addOption = () => setDraft((d) => [...d, { name: "", values: [{ value: "", swatchHex: "" }] }])
  const removeOption = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i))
  const setOptionName = (i: number, name: string) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, name } : o)))
  const addValue = (i: number) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: [...o.values, { value: "", swatchHex: "" }] } : o)))
  const setValue = (i: number, j: number, patch: Partial<DraftValue>) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: o.values.map((v, jdx) => (jdx === j ? { ...v, ...patch } : v)) } : o)))
  const removeValue = (i: number, j: number) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: o.values.filter((_, jdx) => jdx !== j) } : o)))

  const combinations = draft.reduce(
    (acc, o) => acc * o.values.filter((v) => v.value.trim()).length || 0,
    draft.length ? 1 : 0
  )

  const generate = async () => {
    const options: MatrixBody["options"] = draft
      .map((o) => ({
        name: o.name.trim(),
        values: o.values
          .map((v) => ({ value: v.value.trim(), swatchHex: v.swatchHex.trim() || null }))
          .filter((v) => v.value),
      }))
      .filter((o) => o.name && o.values.length)

    if (!options.length) return toast.error("Add at least one option with values")

    const defaults: MatrixBody["defaults"] = {}
    if (defPrice !== "") defaults.price = Number(defPrice)
    if (defStock !== "") defaults.stock = Number(defStock)

    setGenerating(true)
    try {
      const res = await AdminProductService.generateVariantMatrix(productId, {
        options,
        defaults: Object.keys(defaults).length ? defaults : undefined,
      })
      toast.success(`${res.created} variant${res.created !== 1 ? "s" : ""} created${res.skipped ? `, ${res.skipped} already existed` : ""}`)
      setDraft([])
      setDefPrice("")
      setDefStock("")
      onGenerated()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to generate variants")
    } finally {
      setGenerating(false)
    }
  }

  const removeExistingOption = async (optionId: string) => {
    try {
      await AdminProductService.deleteOption(optionId)
      toast.success("Option removed")
      onGenerated()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to remove option")
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing option axes */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {o.name}: {o.values.map((v) => v.value).join(", ")}
              <button type="button" onClick={() => removeExistingOption(o.id)} className="text-gray-400 hover:text-red-500" aria-label="Remove option">
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Draft axes */}
      {draft.map((opt, i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Option name (e.g. Size, Color)"
              value={opt.name}
              onChange={(e) => setOptionName(i, e.target.value)}
            />
            <button type="button" onClick={() => removeOption(i)} className="p-2 text-gray-400 hover:text-red-500" aria-label="Remove option">
              <Trash2 size={15} />
            </button>
          </div>
          <div className="space-y-2 pl-1">
            {opt.values.map((val, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Value (e.g. S, Red)"
                  value={val.value}
                  onChange={(e) => setValue(i, j, { value: e.target.value })}
                />
                <input
                  type="color"
                  title="Optional swatch colour"
                  value={val.swatchHex || "#ffffff"}
                  onChange={(e) => setValue(i, j, { swatchHex: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"
                />
                <button type="button" onClick={() => removeValue(i, j)} disabled={opt.values.length <= 1}
                  className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30" aria-label="Remove value">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addValue(i)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80">
              <Plus size={14} /> Add value
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={addOption} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80">
        <Plus size={15} /> Add option (Size, Color…)
      </button>

      {draft.length > 0 && (
        <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium text-gray-700">
            Defaults for every generated variant (editable afterwards)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} inputMode="decimal" placeholder="Default price" value={defPrice}
              onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) setDefPrice(e.target.value) }} />
            <input className={inputCls} inputMode="numeric" placeholder="Default stock" value={defStock}
              onChange={(e) => { if (e.target.value === "" || /^\d+$/.test(e.target.value)) setDefStock(e.target.value) }} />
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {generating && <Loader2 size={14} className="animate-spin" />}
            Generate {combinations > 0 ? `${combinations} ` : ""}variant{combinations !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  )
}
