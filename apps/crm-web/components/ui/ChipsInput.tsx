"use client"

import clsx from "clsx"
import { X } from "lucide-react"
import { useState } from "react"

interface Props {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  invalid?: boolean
}

/** Type a value and press Enter or comma; pasting "Red, Blue, Black" adds all three. Duplicates are ignored. */
export default function ChipsInput({ id, value, onChange, placeholder, invalid }: Props) {
  const [text, setText] = useState("")

  const add = (raw: string) => {
    const incoming = raw
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean)
    const seen = new Set(value.map((v) => v.toLowerCase()))
    const fresh = incoming.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))
    if (fresh.length) onChange([...value, ...fresh])
    setText("")
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-1.5 min-h-[42px] w-full border rounded-xl px-2 py-1.5 bg-surface focus-within:ring-2 focus-within:ring-primary/20",
        invalid ? "border-red-400" : "border-border",
      )}
    >
      {value.map((chip) => (
        <span key={chip} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text">
          {chip}
          <button
            type="button"
            aria-label={`Remove ${chip}`}
            onClick={() => onChange(value.filter((v) => v !== chip))}
            className="text-faint hover:text-red-500"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add(text)
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => text && add(text)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text")
          if (/[,\n]/.test(pasted)) {
            e.preventDefault()
            add(pasted)
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[8rem] bg-transparent px-1 py-1 text-sm text-text placeholder:text-faint focus:outline-none"
      />
    </div>
  )
}
