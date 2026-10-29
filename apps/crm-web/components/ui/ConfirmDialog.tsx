"use client"

import { AlertTriangle } from "lucide-react"
import Button from "./Button"
import Modal from "./Modal"

interface Props {
  title: string
  message: React.ReactNode
  confirmLabel: string
  tone?: "danger" | "primary"
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Required before every destructive or hard-to-reverse action. */
export default function ConfirmDialog({ title, message, confirmLabel, tone = "danger", loading, onConfirm, onCancel }: Props) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === "danger" && (
          <div className="shrink-0 w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/15 text-red-500 flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>
        )}
        <div className="text-sm text-muted leading-relaxed">{message}</div>
      </div>
    </Modal>
  )
}
