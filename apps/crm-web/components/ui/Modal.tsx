"use client"

import { X } from "lucide-react"
import { useEffect, useId } from "react"

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}

/** Same pattern as the admin's AdminModal: bottom sheet on phones, centred dialog from `sm`. */
export default function Modal({ title, onClose, children, footer, width = "max-w-lg" }: Props) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-surface w-full ${width} shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl`}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-surface-3 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h2 id={titleId} className="text-sm sm:text-base font-semibold text-text">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-2 transition text-muted">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 sm:px-6 py-3 sm:py-4 border-t border-border shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
