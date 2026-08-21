"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, KeyRound, Truck, RefreshCw, Info } from "lucide-react"
import { toast } from "sonner"
import {
  AdminShippingService,
  type WarehouseStatus,
} from "../../../lib/services/admin-shipping.service"
import { friendlyError } from "../../../lib/errorMessages"

/**
 * Delhivery pickup-warehouse status.
 *
 * Shipments reference the pickup location by name only, so a name Delhivery doesn't
 * know fails every manifest with "ClientWarehouse matching query does not exist" —
 * previously visible only as a raw courier string on one order at a time, with no
 * way to check or fix it without a Delhivery panel login.
 */
export default function AdminShippingPage() {
  const [status, setStatus] = useState<WarehouseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await AdminShippingService.getWarehouse())
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't check the pickup warehouse"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const register = async () => {
    if (!confirm("Register this pickup warehouse with Delhivery?")) return
    setRegistering(true)
    try {
      const res = await AdminShippingService.registerWarehouse()
      toast.success(
        res.alreadyRegistered
          ? "This warehouse was already registered."
          : "Pickup warehouse registered."
      )
      await load()
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't register the warehouse"), { duration: 10000 })
    } finally {
      setRegistering(false)
    }
  }

  // Three distinct states, because they need three different fixes: bad credentials,
  // a missing warehouse, and all-clear. Collapsing the first two is what made the
  // original failure so hard to diagnose.
  const authFailed = status?.authenticated === false
  const ok = status?.registered === true
  // registered === null means "Delhivery gives us no way to read this back", NOT
  // "missing". Rendering null as a failure told the operator their working warehouse
  // was unregistered — the exact false alarm this screen exists to prevent.
  const unverifiable = !authFailed && status?.registered === null

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text flex items-center gap-2">
            <Truck size={20} /> Shipping
          </h1>
          <p className="text-sm text-muted mt-1">
            Delhivery pickup warehouse used for every shipment.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted hover:bg-surface-2 transition disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && !status ? (
        <div className="h-32 rounded-2xl bg-surface-2 animate-pulse" />
      ) : !status ? (
        <p className="text-sm text-muted">Couldn&apos;t load the warehouse status.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
          <div className="flex items-start gap-3">
            {ok ? (
              <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
            ) : authFailed ? (
              <KeyRound size={20} className="text-red-500 shrink-0 mt-0.5" />
            ) : unverifiable ? (
              <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-text">
                {ok
                  ? "Pickup warehouse is registered"
                  : authFailed
                    ? "Delhivery rejected our API token"
                    : unverifiable
                      ? "Shipping is configured"
                      : "Pickup warehouse is not registered"}
              </p>
              <p className="text-sm text-muted mt-1">{status.message}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-5">
            <div>
              <dt className="text-faint">Configured name</dt>
              <dd className="text-text font-medium mt-0.5">
                {status.configuredName ?? "— not set —"}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Credentials</dt>
              <dd className="text-text font-medium mt-0.5">
                {authFailed ? "Rejected" : "Accepted"}
              </dd>
            </div>
          </dl>

          {!ok && (
            <div className="border-t border-border pt-5">
              {authFailed ? (
                <p className="text-sm text-muted">
                  Fix <code className="text-text">DELHIVERY_API_TOKEN</code> on the server first.
                  The warehouse can&apos;t be checked or created until the token is valid.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted mb-4">
                    {unverifiable
                      ? "If shipping fails with \"ClientWarehouse matching query does not exist\", this pickup name is wrong or unregistered — register it below, or correct DELHIVERY_PICKUP_NAME to match the Delhivery panel exactly. Note a B2B pickup location is invisible to this (B2C) API."
                      : "Register it using the warehouse address configured on the server (DELHIVERY_WAREHOUSE_*). If the warehouse already exists in the Delhivery panel under a different name, correct DELHIVERY_PICKUP_NAME to match it exactly instead."}
                  </p>
                  <button
                    onClick={register}
                    disabled={registering}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  >
                    {registering ? "Registering…" : "Register warehouse"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
