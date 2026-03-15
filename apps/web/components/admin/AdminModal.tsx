"use client"

import { X } from "lucide-react"
import { useEffect } from "react"

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export default function AdminModal({ title, onClose, children, width = "max-w-lg" }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-2xl w-full ${width} shadow-2xl flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — always pinned, never scrolls away */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body — scrolls independently when content is taller than the modal */}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}