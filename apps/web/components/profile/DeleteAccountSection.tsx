"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { UserService } from "../../lib/services/user.service"
import { useAuthStore } from "../../store/auth.store"

/**
 * Account deletion — required by Google Play and the App Store for any app that
 * allows account creation, and the in-app counterpart to the public
 * /data-deletion page.
 *
 * Confirmation is typed rather than a single click: the action is irreversible,
 * and the copy states the part users do not expect — order and invoice records
 * survive for statutory retention.
 */
export default function DeleteAccountSection() {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

  const onDelete = async () => {
    setDeleting(true)
    try {
      await UserService.deleteAccount()
      toast.success("Your account has been deleted")
      logout()
      router.replace("/")
    } catch (err: any) {
      // 409 carries a specific reason (order in flight, unpaid affiliate balance).
      toast.error(err?.response?.data?.message || "Could not delete your account")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-surface border border-danger/30 rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-bold text-danger">Delete account</h2>
      <p className="text-xs text-faint mt-2 leading-5 max-w-2xl">
        Permanently closes your account and deletes your profile, saved addresses, wishlist and
        reviews. Order and invoice records are kept for up to 8 years, as Indian tax law requires.{" "}
        <Link href="/data-deletion" className="underline hover:text-text">
          Read what is deleted and what is kept
        </Link>
        .
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-danger/40 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/5 transition-colors"
        >
          <Trash2 size={15} />
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-faint">
            Type <span className="font-semibold text-text">DELETE</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-text outline-none focus:border-danger"
            placeholder="DELETE"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onDelete}
              disabled={confirmText !== "DELETE" || deleting}
              className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setConfirmText("")
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text hover:bg-surface-2 transition-colors"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
