"use client"

import clsx from "clsx"

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  onLabel?: string
  offLabel?: string
  disabled?: boolean
  className?: string
}

/** Accessible in/out switch. Shows a label that reflects the current state. */
export default function Toggle({
  checked,
  onChange,
  onLabel = "In stock",
  offLabel = "Out of stock",
  disabled,
  className,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "inline-flex items-center gap-2.5 select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={clsx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-3"
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      <span className={clsx("text-sm font-medium", checked ? "text-primary" : "text-muted")}>
        {checked ? onLabel : offLabel}
      </span>
    </button>
  )
}
