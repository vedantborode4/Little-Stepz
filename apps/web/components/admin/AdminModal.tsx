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
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div
        className={`bg-white w-full ${width} shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
