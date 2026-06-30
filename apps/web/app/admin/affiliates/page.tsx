"use client"

import { useEffect, useState } from "react"
import { UserPlus, Eye } from "lucide-react"
import { AdminAffiliateService, type AdminAffiliate } from "../../../lib/services/admin-affiliate.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AffiliateStatusBadge from "../../../components/admin/affiliates/AffiliateStatusBadge"
import AffiliateApproveModal from "../../../components/admin/affiliates/AffiliateApproveModal"
import AffiliateInviteModal from "../../../components/admin/affiliates/AffiliateInviteModal"
import { toast } from "sonner"
import Link from "next/link"

const TABS = [{ label: "All", value: "" },{ label: "Pending", value: "PENDING" },{ label: "Approved", value: "APPROVED" },{ label: "Rejected", value: "REJECTED" }]

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([])
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [modalAffiliate, setModalAffiliate] = useState<AdminAffiliate | null>(null)
  const [modalAction, setModalAction] = useState<"approve" | "reject">("approve")
  const [inviteOpen, setInviteOpen] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminAffiliateService.getAll({ status: tab || undefined, page, limit: 10 })
      setAffiliates(res.affiliates)
      setPagination({ total: res.pagination.total, pages: res.pagination.pages })
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load affiliates")
      setAffiliates([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const handleTabChange = (v: string) => { setTab(v); setPage(1); setSelected([]) }
  const toggleSelect = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelected(selected.length === affiliates.length ? [] : affiliates.map(a => a.id))

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader title="Affiliates" subtitle={`${pagination.total} total`}
        action={
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            <UserPlus size={15} /> <span className="hidden sm:inline">Invite Affiliate</span><span className="sm:hidden">Invite</span>
          </button>
        }
      />

      {/* Tabs — scrollable on mobile */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.value} onClick={() => handleTabChange(t.value)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={8} cols={7} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-gray-500 text-left">
                  <th className="p-4 w-10"><input type="checkbox" checked={selected.length === affiliates.length && affiliates.length > 0} onChange={toggleAll} className="rounded accent-primary"/></th>
                  <th className="p-4 font-medium">Affiliate</th>
                  <th className="p-4 font-medium">Referral Code</th>
                  <th className="p-4 font-medium">Commission</th>
                  <th className="p-4 font-medium">Earnings</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                    <td className="p-4"><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleSelect(a.id)} className="rounded accent-primary"/></td>
                    <td className="p-4"><div><p className="font-medium text-gray-900">{a.user.name}</p><p className="text-xs text-gray-400">{a.user.email}</p></div></td>
                    <td className="p-4"><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg">{a.referralCode}</span></td>
                    <td className="p-4 text-gray-700">{(a.commissionRate * 100).toFixed(0)}% · {a.commissionType}</td>
                    <td className="p-4"><div><p className="font-semibold text-gray-900">₹{a.totalCommission.toLocaleString()}</p><p className="text-xs text-gray-400">Pending: ₹{a.pendingBalance.toLocaleString()}</p></div></td>
                    <td className="p-4"><AffiliateStatusBadge status={a.status} /></td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/affiliates/${a.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"><Eye size={14} /></Link>
                        {a.status === "PENDING" && (
                          <>
                            <button onClick={() => { setModalAffiliate(a); setModalAction("approve") }} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600">Approve</button>
                            <button onClick={() => { setModalAffiliate(a); setModalAction("reject") }} className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50">Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!affiliates.length && (<tr><td colSpan={7} className="py-16 text-center text-gray-400">No affiliates found</td></tr>)}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-gray-100">
            {affiliates.map(a => (
              <div key={a.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.user.name}</p>
                    <p className="text-xs text-gray-400">{a.user.email}</p>
                  </div>
                  <AffiliateStatusBadge status={a.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded-lg">{a.referralCode}</span>
                  <span className="text-gray-600">{(a.commissionRate * 100).toFixed(0)}% · {a.commissionType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900 text-sm">₹{a.totalCommission.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-2">Pending: ₹{a.pendingBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/affiliates/${a.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Eye size={14} /></Link>
                    {a.status === "PENDING" && (
                      <>
                        <button onClick={() => { setModalAffiliate(a); setModalAction("approve") }} className="px-2.5 py-1 bg-green-500 text-white rounded-lg text-xs font-medium">Approve</button>
                        <button onClick={() => { setModalAffiliate(a); setModalAction("reject") }} className="px-2.5 py-1 border border-red-200 text-red-500 rounded-lg text-xs font-medium">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!affiliates.length && (<div className="py-16 text-center text-gray-400 text-sm">No affiliates found</div>)}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-gray-500">Page {page} of {pagination.pages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                <span className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-lg text-sm font-medium">{String(page).padStart(2, "0")}</span>
                <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalAffiliate && (
        <AffiliateApproveModal affiliate={modalAffiliate} action={modalAction}
          onClose={() => setModalAffiliate(null)} onSuccess={() => { setModalAffiliate(null); fetch() }} />
      )}

      {inviteOpen && <AffiliateInviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
